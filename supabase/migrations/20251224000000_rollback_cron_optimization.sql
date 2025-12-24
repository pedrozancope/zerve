-- ============================================
-- Rollback: Restaurar Frequência Original dos Cron Jobs
-- ============================================
-- Reverte as otimizações de frequência aplicadas na migration
-- 20251223150000_optimize_cron_schedule_frequency.sql
-- 
-- Jobs restaurados:
-- 1. check-and-execute-schedules: volta para todo minuto (*)
-- 2. preflight-check: volta para minuto 30 de cada hora
--
-- Motivo: Necessidade de verificações mais frequentes
-- ============================================

-- 1. Restaurar job de verificação de schedules para rodar todo minuto
DO $$
BEGIN
  -- Remover job otimizado
  PERFORM cron.unschedule('check-and-execute-schedules');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar se não existir
  NULL;
END $$;

-- Criar job com frequência original - roda todo minuto
DO $$
BEGIN
  PERFORM cron.schedule(
    'check-and-execute-schedules',
    '* * * * *',  -- Todo minuto
    'SELECT check_and_execute_schedules();'
  );
  
  RAISE NOTICE 'Job check-and-execute-schedules restaurado: agora roda todo minuto';
END $$;

-- 2. Restaurar job de preflight para minuto 30
DO $$
DECLARE
  v_job_id BIGINT;
  v_supabase_url TEXT;
BEGIN
  -- Remover job otimizado de preflight
  BEGIN
    PERFORM cron.unschedule('preflight-check');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  -- Obter URL do Supabase das configurações
  SELECT value INTO v_supabase_url 
  FROM system_config 
  WHERE key = 'supabase_url';
  
  -- Se não conseguiu pela system_config, tentar app_config
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    SELECT value INTO v_supabase_url 
    FROM app_config 
    WHERE key = 'supabase_url';
  END IF;
  
  -- Criar o job apenas se conseguirmos a URL
  IF v_supabase_url IS NOT NULL AND v_supabase_url != '' THEN
    -- Job que roda todo minuto
    SELECT cron.schedule(
      'preflight-check',
      '* * * * *', -- Todo minuto
      format(
        'SELECT net.http_post(
          url:=''%s/functions/v1/run-preflight'',
          headers:=''{"Content-Type": "application/json", "Authorization": "Bearer '' || current_setting(''supabase.service_role_key'', true) || ''"}''::jsonb,
          body:=''{}''::jsonb
        )',
        v_supabase_url
      )
    ) INTO v_job_id;
    
    RAISE NOTICE 'Job preflight-check restaurado: agora roda todo minuto (job id: %)', v_job_id;
  ELSE
    RAISE WARNING 'Não foi possível restaurar preflight-check - Supabase URL não configurada';
  END IF;
END $$;

-- 3. Atualizar comentários e documentação
COMMENT ON FUNCTION check_and_execute_schedules() IS 
  'Verifica e executa schedules pendentes. Chamada todo minuto pelo pg_cron.';

-- ============================================
-- Para verificar os jobs restaurados:
-- ============================================
-- SELECT jobid, jobname, schedule, command 
-- FROM cron.job 
-- WHERE jobname IN ('check-and-execute-schedules', 'preflight-check');
--
-- Para ver histórico de execuções:
-- SELECT * FROM cron.job_run_details 
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname IN ('check-and-execute-schedules', 'preflight-check'))
-- ORDER BY start_time DESC 
-- LIMIT 20;
