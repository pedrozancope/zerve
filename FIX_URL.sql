-- Corrigir URL do cron - URL estava errada!
SELECT cron.unschedule('preflight-check');

SELECT cron.schedule(
  'preflight-check',
  '* * * * *',
  $$
    SELECT net.http_post(
      url:='https://ojvbsuprjhvesbwybmqc.supabase.co/functions/v1/run-preflight',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'supabase_service_role_key' LIMIT 1)
      ),
      body:='{}'::jsonb
    )
  $$
);
