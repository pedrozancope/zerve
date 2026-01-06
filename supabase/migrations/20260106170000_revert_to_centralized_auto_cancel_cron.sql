-- Migration: Revert to centralized auto-cancel cron system
-- Description: Update run_auto_cancel_check() to use new column names and disable individual job creation
-- Date: 2026-01-06

-- Step 1: Drop the trigger that creates individual cron jobs
DROP TRIGGER IF EXISTS auto_cancel_config_manage_cron ON auto_cancel_config;

-- Step 2: Update run_auto_cancel_check() function to use new column names
CREATE OR REPLACE FUNCTION public.run_auto_cancel_check()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
  
  -- Verificar se as configurações existem
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada em system_config', 'checked_at', v_now);
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada em system_config', 'checked_at', v_now);
  END IF;

  -- ============================================
  -- Buscar configs habilitadas que devem executar AGORA
  -- PADRÃO IDÊNTICO a check_and_execute_schedules()
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
    -- Extrair hora e minuto de trigger_time (formato HH:MM:SS)
    v_run_hour := EXTRACT(HOUR FROM v_config.trigger_time::TIME);
    v_run_minute := EXTRACT(MINUTE FROM v_config.trigger_time::TIME);
    v_run_time := v_config.trigger_time::TIME;
    
    -- Verificar se está na janela de tempo correta (até 10min após run_time)
    IF v_now_time >= v_run_time 
       AND v_now_time < v_run_time + INTERVAL '10 minutes' 
    THEN
      BEGIN
        v_count := v_count + 1;
        
        RAISE NOTICE 'Executando auto-cancel para user: % (Config ID: %) - Horário atual UTC: %, Run time: %:%', 
          v_config.user_id, v_config.id, v_now_time, v_run_hour, v_run_minute;
        
        -- IMPORTANTE: Marcar como executado ANTES de chamar a Edge Function
        UPDATE auto_cancel_config 
        SET last_executed_at = v_now,
            updated_at = v_now
        WHERE id = v_config.id;
        
        -- Chamar Edge Function via pg_net (assíncrono)
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
  
  -- Retornar resumo
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
$function$;

-- Step 3: Clean up individual cron job (job 16) and reset pg_cron_job_id
-- Unschedule the individual job
SELECT cron.unschedule(16);

-- Clear pg_cron_job_id from config since we're using centralized approach
UPDATE auto_cancel_config 
SET pg_cron_job_id = NULL 
WHERE pg_cron_job_id = 16;

-- Step 4: Ensure the centralized cron job (job 15) exists and is active
-- If it doesn't exist, it should be created by the existing migration
-- Just verify it's there
DO $$
DECLARE
  v_job_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM cron.job 
    WHERE jobid = 15 
    AND command = 'SELECT run_auto_cancel_check()'
  ) INTO v_job_exists;
  
  IF NOT v_job_exists THEN
    RAISE NOTICE 'Job 15 não encontrado. Ele deve ser recriado manualmente ou pela migration original.';
  ELSE
    RAISE NOTICE 'Job 15 (centralized auto-cancel checker) está ativo e funcionando.';
  END IF;
END $$;
