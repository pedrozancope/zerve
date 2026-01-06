-- Migration: Configurar pg_cron para executar agendamentos trigger_date
-- Executar no SQL Editor do Supabase

-- 1. Criar um job pg_cron que verifica agendamentos a cada minuto
-- Este job chama a Edge Function check-scheduled-triggers
SELECT cron.schedule(
  'check-scheduled-triggers',                    -- Nome do job
  '* * * * *',                                   -- Executa a cada minuto
  $$
  SELECT
    net.http_post(
      url := 'https://ojvbsuprjhvesbwybmqc.supabase.co/functions/v1/check-scheduled-triggers',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    ) AS request_id;
  $$
);

-- 2. Comentário para documentação
COMMENT ON EXTENSION pg_cron IS 'Job check-scheduled-triggers verifica agendamentos com trigger_mode=trigger_date a cada minuto e os executa quando trigger_datetime é atingido';
