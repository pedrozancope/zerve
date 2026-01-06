-- Migration: Fix COALESCE syntax in manage_auto_cancel_cron_job function
-- Description: Fix "argument of OR must be type boolean" error by using COALESCE instead of OR
-- Date: 2026-01-06

-- Drop the trigger and function first
DROP TRIGGER IF EXISTS auto_cancel_config_manage_cron ON auto_cancel_config;
DROP FUNCTION IF EXISTS public.manage_auto_cancel_cron_job() CASCADE;

-- Recreate the function with correct COALESCE syntax
CREATE FUNCTION public.manage_auto_cancel_cron_job()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  v_hour INT;
  v_minute INT;
  v_cron_schedule TEXT;
  v_job_id BIGINT;
  v_job_name TEXT;
  v_supabase_url TEXT;
BEGIN
  -- Extrair hora e minuto de trigger_time (formato HH:MM:SS)
  v_hour := EXTRACT(HOUR FROM NEW.trigger_time::TIME);
  v_minute := EXTRACT(MINUTE FROM NEW.trigger_time::TIME);
  
  -- Construir nome único do job
  v_job_name := 'auto_cancel_' || NEW.id;
  
  -- Obter URL base do Supabase do ambiente
  v_supabase_url := COALESCE(current_setting('app.settings.supabase_url', true), 'https://jzflkhtqtryaagzzypxr.supabase.co');
  
  -- Se estava ativo anteriormente, remover o job antigo
  IF OLD IS NOT NULL AND OLD.pg_cron_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(OLD.pg_cron_job_id);
    RAISE NOTICE 'Auto-cancel cron job % removido', OLD.pg_cron_job_id;
  END IF;
  
  -- Se está ativo, criar novo job
  IF NEW.is_active THEN
    -- Montar expressão cron: "minuto hora * * *"
    v_cron_schedule := format('%s %s * * *', v_minute, v_hour);
    
    -- Criar novo job usando cron.schedule
    SELECT cron.schedule(
      v_job_name,
      v_cron_schedule,
      format(
        'SELECT http_post(''%s/functions/v1/run-auto-cancel'', json_build_object(''configId'', ''%s''), ''application/json'')',
        v_supabase_url,
        NEW.id
      )
    ) INTO v_job_id;
    
    -- Atualizar o ID do job na tabela
    NEW.pg_cron_job_id := v_job_id;
    
    RAISE NOTICE 'Auto-cancel cron job % criado com expressão: %', v_job_id, v_cron_schedule;
  ELSIF NEW.pg_cron_job_id IS NOT NULL THEN
    -- Se desabilitado mas tinha job, garantir que está removido
    PERFORM cron.unschedule(NEW.pg_cron_job_id);
    NEW.pg_cron_job_id := NULL;
    RAISE NOTICE 'Auto-cancel cron job removido (desabilitado)';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger with the updated function
CREATE TRIGGER auto_cancel_config_manage_cron
  BEFORE INSERT OR UPDATE ON auto_cancel_config
  FOR EACH ROW
  EXECUTE FUNCTION manage_auto_cancel_cron_job();
