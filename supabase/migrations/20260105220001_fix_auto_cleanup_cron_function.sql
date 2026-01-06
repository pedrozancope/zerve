-- ============================================
-- Fix: Auto-Cleanup Cron Job Function
-- Corrige erro ao tentar remover job inexistente
-- ============================================

-- Atualiza a função para verificar se o job existe antes de remover
CREATE OR REPLACE FUNCTION update_auto_cleanup_cron_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name TEXT;
  utc_hour INTEGER;
  cron_expression TEXT;
  function_url TEXT;
  service_role_key TEXT;
  job_exists BOOLEAN;
BEGIN
  job_name := 'auto-cleanup-' || NEW.user_id::TEXT;
  
  -- Verifica se o job existe antes de tentar remover
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;
  
  IF job_exists THEN
    PERFORM cron.unschedule(job_name);
  END IF;
  
  -- Se desabilitado, apenas remove o job (se existia)
  IF NOT NEW.enabled THEN
    RETURN NEW;
  END IF;
  
  -- Calcular hora UTC a partir do horário BRT configurado
  utc_hour := get_utc_hour_from_brt(NEW.run_time);
  
  -- Cron expression: minuto 0 da hora UTC, todos os dias
  cron_expression := '0 ' || utc_hour || ' * * *';
  
  -- Obter URL da função e service role key
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/run-post-reservation-cleanup';
  service_role_key := current_setting('app.service_role_key', true);
  
  -- Agendar o job usando pg_net para chamar a Edge Function
  PERFORM cron.schedule(
    job_name,
    cron_expression,
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || %L), body := jsonb_build_object(''userId'', %L))',
      function_url,
      service_role_key,
      NEW.user_id::TEXT
    )
  );
  
  RAISE NOTICE 'Auto-cleanup cron job % scheduled at % UTC (% BRT)', job_name, utc_hour, EXTRACT(HOUR FROM NEW.run_time);
  
  RETURN NEW;
END;
$$;

-- Também corrige a função de remoção
CREATE OR REPLACE FUNCTION remove_auto_cleanup_cron_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name TEXT;
  job_exists BOOLEAN;
BEGIN
  job_name := 'auto-cleanup-' || OLD.user_id::TEXT;
  
  -- Verifica se o job existe antes de tentar remover
  SELECT EXISTS(SELECT 1 FROM cron.job WHERE jobname = job_name) INTO job_exists;
  
  IF job_exists THEN
    PERFORM cron.unschedule(job_name);
  END IF;
  
  RETURN OLD;
END;
$$;
