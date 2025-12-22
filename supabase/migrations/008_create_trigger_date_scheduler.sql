-- Migration: Criar job global que verifica schedules com trigger_date
-- Este job roda a cada minuto e executa schedules prontos

-- 1. Criar função que verifica e executa schedules pendentes
CREATE OR REPLACE FUNCTION execute_pending_trigger_date_schedules()
RETURNS void AS $$
DECLARE
  v_schedule RECORD;
  v_request_id BIGINT;
BEGIN
  -- Buscar schedules ativos com trigger_date que devem executar agora
  FOR v_schedule IN
    SELECT id, name, trigger_datetime
    FROM schedules
    WHERE is_active = TRUE
      AND trigger_mode = 'trigger_date'
      AND trigger_datetime IS NOT NULL
      AND trigger_datetime <= NOW()
      AND trigger_datetime >= NOW() - INTERVAL '2 minutes' -- margem de segurança
  LOOP
    BEGIN
      RAISE NOTICE 'Executing schedule % (%) scheduled for %', 
        v_schedule.id, v_schedule.name, v_schedule.trigger_datetime;
      
      -- Chamar Edge Function para executar a reserva
      SELECT net.http_post(
        url := 'https://ojvbsuprjhvesbwybmqc.supabase.co/functions/v1/execute-reservation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
        ),
        body := jsonb_build_object('scheduleId', v_schedule.id)
      ) INTO v_request_id;
      
      -- Se frequência é 'once', desativar o schedule
      UPDATE schedules 
      SET is_active = FALSE 
      WHERE id = v_schedule.id 
        AND frequency = 'once';
      
      RAISE NOTICE 'Schedule % executed successfully (request_id: %)', 
        v_schedule.id, v_request_id;
        
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Error executing schedule %: %', v_schedule.id, SQLERRM;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Criar job pg_cron que roda a cada minuto
SELECT cron.schedule(
  'check-trigger-date-schedules',  -- Nome único do job
  '* * * * *',                      -- Roda a cada minuto
  $$SELECT execute_pending_trigger_date_schedules();$$
);

-- 3. Comentário para documentação
COMMENT ON FUNCTION execute_pending_trigger_date_schedules() IS 
  'Verifica e executa schedules com trigger_mode=trigger_date que estão prontos. Roda a cada minuto via pg_cron.';
