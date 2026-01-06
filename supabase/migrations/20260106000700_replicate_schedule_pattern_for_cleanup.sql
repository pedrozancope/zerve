-- ============================================
-- COPIE E EXECUTE NO SQL EDITOR DO SUPABASE DASHBOARD
-- ============================================
-- Este script replica o padrão de check_and_execute_schedules()
-- que FUNCIONA perfeitamente para o auto-cleanup
-- ============================================

DROP FUNCTION IF EXISTS run_automatic_cleanup() CASCADE;

CREATE OR REPLACE FUNCTION run_automatic_cleanup()
RETURNS jsonb AS $$
DECLARE
  v_config RECORD;
  v_request_id BIGINT;
  v_results jsonb := '[]'::jsonb;
  v_service_key TEXT;
  v_supabase_url TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_now_brt TIMESTAMPTZ := NOW() AT TIME ZONE 'America/Sao_Paulo';
  v_now_time_brt TIME := (NOW() AT TIME ZONE 'America/Sao_Paulo')::time;
  v_today_brt DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_count INT := 0;
BEGIN
  -- Obter configurações da tabela system_config
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  -- Verificar se as configurações existem
  IF v_service_key IS NULL OR v_service_key = '' OR v_service_key = 'CONFIGURE_SUA_SERVICE_ROLE_KEY_AQUI' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada', 'checked_at', v_now);
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada', 'checked_at', v_now);
  END IF;

  -- ============================================
  -- Buscar configs que devem executar AGORA
  -- REGRA: Janela de 10min APÓS o horário configurado
  -- ============================================
  FOR v_config IN
    SELECT 
      id,
      user_id,
      run_time,
      last_run_at,
      cancellation_reason
    FROM auto_cleanup_config
    WHERE enabled = TRUE
      -- Não executar se já foi executado hoje (nas últimas 23 horas)
      AND (
        last_run_at IS NULL 
        OR (last_run_at AT TIME ZONE 'America/Sao_Paulo')::date < v_today_brt
      )
      -- Verifica se está na janela de tempo correta (até 10min após run_time)
      AND v_now_time_brt >= run_time::time
      AND v_now_time_brt < run_time::time + INTERVAL '10 minutes'
  LOOP
    BEGIN
      v_count := v_count + 1;
      
      RAISE NOTICE 'Executando auto-cleanup para user: % (Config ID: %) - Horário atual BRT: %, Run time: %', 
        v_config.user_id, v_config.id, v_now_brt, v_config.run_time;
      
      -- IMPORTANTE: Marcar como executado ANTES de chamar a Edge Function
      -- Isso evita que seja executado novamente no próximo minuto
      UPDATE auto_cleanup_config 
      SET last_run_at = v_now,
          updated_at = v_now
      WHERE id = v_config.id;
      
      -- Chamar Edge Function via pg_net (assíncrono) - IGUAL A check_and_execute_schedules
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/run-post-reservation-cleanup',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'userId', v_config.user_id::text,
          'dryRun', false,
          'manual', false
        ),
        timeout_milliseconds := 60000
      ) INTO v_request_id;
      
      -- Registrar resultado
      v_results := v_results || jsonb_build_object(
        'config_id', v_config.id,
        'user_id', v_config.user_id,
        'request_id', v_request_id,
        'executed_at', v_now,
        'run_time', v_config.run_time
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao executar auto-cleanup config %: %', v_config.id, SQLERRM;
      v_results := v_results || jsonb_build_object(
        'config_id', v_config.id,
        'user_id', v_config.user_id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Retornar resumo (formato IDÊNTICO a check_and_execute_schedules)
  RETURN jsonb_build_object(
    'checked_at', v_now,
    'checked_at_brt', v_now_brt,
    'current_time_brt', v_now_time_brt,
    'today_brt', v_today_brt,
    'configs_found', v_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions (igual a check_and_execute_schedules)
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO postgres;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO authenticated;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO service_role;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO anon;

COMMENT ON FUNCTION run_automatic_cleanup() IS 
  'Verifica e executa auto-cleanup de reservas. Executa na janela de 10min após run_time. Padrão replicado de check_and_execute_schedules().';

-- ============================================
-- TESTE MANUAL (opcional)
-- ============================================
-- Descomente para testar:
-- SELECT run_automatic_cleanup();
