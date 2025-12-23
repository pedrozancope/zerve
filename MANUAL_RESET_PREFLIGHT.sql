-- Script para resetar manualmente o preflight do agendamento atual
-- Use este script caso precise forçar o preflight a rodar novamente imediatamente

-- 1. Resetar last_preflight_at do agendamento "Teste para logs"
UPDATE schedules
SET last_preflight_at = NULL
WHERE name = 'Teste para logs'
  AND preflight_enabled = true;

-- 2. Verificar o status atual
SELECT 
  id,
  name,
  trigger_datetime,
  preflight_enabled,
  preflight_hours_before,
  last_preflight_at,
  CASE 
    WHEN trigger_datetime IS NOT NULL 
    THEN trigger_datetime - (preflight_hours_before || ' hours')::INTERVAL
    ELSE NULL
  END as preflight_deadline,
  is_active
FROM schedules
WHERE name = 'Teste para logs';

-- 3. Verificar quando o próximo cron de preflight vai rodar
SELECT 
  jobname,
  schedule,
  command,
  active,
  jobid
FROM cron.job
WHERE jobname = 'preflight-check';

