-- ============================================
-- HOTFIX: Corrigir run_auto_cancel_check() com nomes de coluna corretos
-- Data: 19/02/2026
-- ============================================
--
-- PROBLEMA: A migration 20260210000002 reescreveu run_auto_cancel_check()
-- usando nomes de colunas antigos (run_hour, run_minute, enabled, last_run_at,
-- last_checked_at) que foram renomeados/removidos na migration 20260106140000.
--
-- Resultado: a função falhava com "column does not exist" a cada execução,
-- impedindo o auto-cancel de rodar nos últimos 10 dias.
--
-- CORREÇÃO: Reescrever usando os nomes corretos:
--   enabled        → is_active
--   run_hour/min   → trigger_time (TIME)
--   last_run_at    → last_executed_at
--   last_checked_at → removida
-- ============================================

CREATE OR REPLACE FUNCTION run_auto_cancel_check()
RETURNS jsonb AS $$
DECLARE
  v_config RECORD;
  v_request_id BIGINT;
  v_results jsonb := '[]'::jsonb;
  v_service_key TEXT;
  v_supabase_url TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_now_time TIME := v_now::time;
  v_count INT := 0;
  v_run_time TIME;
  v_run_hour INT;
  v_run_minute INT;
BEGIN
  -- Obter configurações da tabela system_config
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada em system_config', 'checked_at', v_now);
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada em system_config', 'checked_at', v_now);
  END IF;

  -- ============================================
  -- Buscar configs habilitadas que devem executar AGORA
  -- Colunas corretas: is_active, trigger_time, last_executed_at
  -- Janela de 15 minutos para compatibilidade com cron */10
  -- ============================================
  FOR v_config IN
    SELECT 
      id,
      user_id,
      trigger_time,
      cancellation_reason,
      last_executed_at
    FROM auto_cancel_config
    WHERE is_active = TRUE
      -- Não executar se já foi executado nos últimos 15 minutos
      AND (last_executed_at IS NULL OR last_executed_at < v_now - INTERVAL '15 minutes')
  LOOP
    -- Extrair hora e minuto de trigger_time (formato TIME HH:MM:SS)
    v_run_hour := EXTRACT(HOUR FROM v_config.trigger_time)::INTEGER;
    v_run_minute := EXTRACT(MINUTE FROM v_config.trigger_time)::INTEGER;
    v_run_time := v_config.trigger_time;
    
    -- Janela de 15 minutos após run_time (compatível com cron */10)
    IF v_now_time >= v_run_time 
       AND v_now_time < v_run_time + INTERVAL '15 minutes' 
    THEN
      BEGIN
        v_count := v_count + 1;
        
        RAISE NOTICE 'Executando auto-cancel para user: % (Config ID: %) - Horário atual UTC: %, Run time: %:%', 
          v_config.user_id, v_config.id, v_now_time, v_run_hour, v_run_minute;
        
        -- Marcar como executado ANTES de chamar Edge Function
        UPDATE auto_cancel_config 
        SET last_executed_at = v_now,
            updated_at = v_now
        WHERE id = v_config.id;
        
        -- Chamar Edge Function via pg_net
        SELECT net.http_post(
          url := v_supabase_url || '/functions/v1/run-auto-cancel',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'userId', v_config.user_id::text,
            'dryRun', false,
            'adHoc', false
          ),
          timeout_milliseconds := 60000
        ) INTO v_request_id;
        
        v_results := v_results || jsonb_build_object(
          'config_id', v_config.id,
          'user_id', v_config.user_id,
          'request_id', v_request_id,
          'executed_at', v_now,
          'run_time', format('%s:%s', v_run_hour, v_run_minute)
        );
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao executar auto-cancel config %: %', v_config.id, SQLERRM;
        v_results := v_results || jsonb_build_object(
          'config_id', v_config.id,
          'user_id', v_config.user_id,
          'error', SQLERRM
        );
      END;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'checked_at', v_now,
    'current_time_utc', v_now_time,
    'configs_found', v_count,
    'results', v_results
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'checked_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO postgres;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO authenticated;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO service_role;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO anon;

COMMENT ON FUNCTION run_auto_cancel_check() IS 
  'Verifica e executa auto-cancel de reservas. Roda a cada 10 min via pg_cron. Janela de 15 min após trigger_time (UTC). Guard de 15 min contra re-execução.';
