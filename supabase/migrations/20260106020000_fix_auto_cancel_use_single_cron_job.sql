-- ============================================
-- Fix: Auto-Cancel - Usar UM cron job global (padrão correto)
-- ============================================
-- Problema: Estava usando triggers para criar jobs per-config
-- Solução: Usar UM cron job global que roda uma função que busca todas as configs
-- Padrão idêntico a check_and_execute_schedules() e call_preflight_edge_function()
-- ============================================

-- 1. Remover triggers e funções antigas
DROP TRIGGER IF EXISTS auto_cancel_config_manage_cron ON auto_cancel_config;
DROP TRIGGER IF EXISTS auto_cancel_config_remove_cron ON auto_cancel_config;
DROP FUNCTION IF EXISTS manage_auto_cancel_cron_job() CASCADE;
DROP FUNCTION IF EXISTS remove_auto_cancel_cron_job() CASCADE;

-- 2. Remover qualquer cron job antigo per-config
DO $$
DECLARE
  v_config RECORD;
BEGIN
  FOR v_config IN SELECT id, pg_cron_job_id FROM auto_cancel_config WHERE pg_cron_job_id IS NOT NULL
  LOOP
    BEGIN
      PERFORM cron.unschedule(v_config.pg_cron_job_id);
      RAISE NOTICE 'Removido cron job % da config %', v_config.pg_cron_job_id, v_config.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao remover cron job % da config %: %', v_config.pg_cron_job_id, v_config.id, SQLERRM;
    END;
  END LOOP;
END $$;

-- 3. Limpar campo pg_cron_job_id (não será mais usado por config individual)
UPDATE auto_cancel_config SET pg_cron_job_id = NULL;

-- 4. Adicionar campo last_checked_at para controlar janela de execução
ALTER TABLE auto_cancel_config
  ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP WITH TIME ZONE;

-- 5. Criar função que verifica e executa auto-cancel (padrão idêntico aos outros sistemas)
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
  -- Buscar configs habilitadas que devem executar AGORA
  -- REGRA: Executa na janela de 10min APÓS o horário configurado (UTC)
  -- IMPORTANTE: run_hour e run_minute são em UTC (igual aos schedules)
  -- ============================================
  FOR v_config IN
    SELECT 
      id,
      user_id,
      run_hour,
      run_minute,
      cancellation_reason,
      last_run_at,
      last_checked_at
    FROM auto_cancel_config
    WHERE enabled = TRUE
      -- Não executar se já foi executado recentemente (últimas 20 horas)
      AND (
        last_run_at IS NULL 
        OR last_run_at < v_now - INTERVAL '20 hours'
      )
  LOOP
    -- Construir horário configurado (em UTC)
    v_run_time := make_time(v_config.run_hour, v_config.run_minute, 0);
    
    -- Verificar se está na janela de tempo correta (até 10min após run_time)
    -- NUNCA antes, até 10 minutos depois (padrão de check_and_execute_schedules)
    IF v_now_time >= v_run_time 
       AND v_now_time < v_run_time + INTERVAL '10 minutes' 
    THEN
      BEGIN
        v_count := v_count + 1;
        
        RAISE NOTICE 'Executando auto-cancel para user: % (Config ID: %) - Horário atual UTC: %, Run time: %:%', 
          v_config.user_id, v_config.id, v_now_time, v_config.run_hour, v_config.run_minute;
        
        -- IMPORTANTE: Marcar como executado ANTES de chamar a Edge Function
        -- Isso evita que seja executado novamente no próximo minuto
        UPDATE auto_cancel_config 
        SET last_run_at = v_now,
            last_checked_at = v_now,
            updated_at = v_now
        WHERE id = v_config.id;
        
        -- Chamar Edge Function via pg_net (assíncrono) - PADRÃO IDÊNTICO aos outros
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
        
        -- Registrar resultado
        v_results := v_results || jsonb_build_object(
          'config_id', v_config.id,
          'user_id', v_config.user_id,
          'request_id', v_request_id,
          'executed_at', v_now,
          'run_time', format('%s:%s', v_config.run_hour, v_config.run_minute)
        );
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao executar auto-cancel config %: %', v_config.id, SQLERRM;
        v_results := v_results || jsonb_build_object(
          'config_id', v_config.id,
          'user_id', v_config.user_id,
          'error', SQLERRM
        );
      END;
    ELSE
      -- Apenas atualizar last_checked_at
      UPDATE auto_cancel_config 
      SET last_checked_at = v_now
      WHERE id = v_config.id;
    END IF;
  END LOOP;
  
  -- Retornar resumo (formato IDÊNTICO aos outros sistemas)
  RETURN jsonb_build_object(
    'checked_at', v_now,
    'current_time_utc', v_now_time,
    'configs_found', v_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant permissions (padrão idêntico)
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO postgres;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO authenticated;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO service_role;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO anon;

-- 7. Criar UM cron job global que roda a cada minuto
-- (idêntico a check_and_execute_schedules e call_preflight_edge_function)
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  -- Remover job antigo se existir
  PERFORM cron.unschedule('auto-cancel-check');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar erro se o job não existir
  NULL;
END $$;

SELECT cron.schedule(
  'auto-cancel-check',
  '* * * * *', -- Todo minuto (verifica configs e executa se necessário)
  'SELECT run_auto_cancel_check()'
);

-- 8. Comentários
COMMENT ON FUNCTION run_auto_cancel_check() IS 
  'Verifica e executa auto-cancel de reservas. Roda todo minuto via pg_cron. Executa na janela de 10min após o horário configurado (UTC). Padrão replicado de check_and_execute_schedules().';

COMMENT ON COLUMN auto_cancel_config.run_hour IS 
  'Hora (0-23) em UTC (não BRT) em que o cancelamento deve executar. Padrão igual aos schedules.';

COMMENT ON COLUMN auto_cancel_config.run_minute IS 
  'Minuto (0-59) em que o cancelamento deve executar';

COMMENT ON COLUMN auto_cancel_config.pg_cron_job_id IS 
  '[DEPRECATED] Campo não mais usado. Sistema agora usa um cron job global.';

COMMENT ON COLUMN auto_cancel_config.last_checked_at IS 
  'Última vez que o cron job verificou esta config (atualizado todo minuto quando o job roda)';

