-- ============================================
-- TESTE MANUAL: Forçar execução de Pre-flight
-- ============================================
-- Este script força a execução do pre-flight para um agendamento específico
-- resetando o last_preflight_at
-- 1. Ver agendamentos com preflight habilitado
SELECT
  id,
  name,
  preflight_enabled,
  preflight_hours_before,
  trigger_mode,
  trigger_datetime,
  trigger_time,
  last_preflight_at,
  is_active
FROM
  schedules
WHERE
  preflight_enabled = true
  AND is_active = true;

-- 2. Resetar last_preflight_at para forçar nova execução
-- IMPORTANTE: Substitua o UUID pelo ID do seu agendamento
UPDATE schedules
SET
  last_preflight_at = NULL
WHERE
  id = '025977c6-9e79-44b1-bb7e-a79be64cf94b';

-- Seu agendamento de teste
-- 3. Verificar status dos cron jobs
SELECT
  jobid,
  schedule,
  command,
  active,
  jobname
FROM
  cron.job
WHERE
  jobname = 'preflight-check';

-- 4. Forçar execução manual do preflight (via HTTP)
-- Você pode executar isso via curl no terminal:
-- curl -X POST https://ifsgngdptmzovzuvudah.supabase.co/functions/v1/run-preflight \
--   -H "Authorization: Bearer [SEU_SERVICE_ROLE_KEY]" \
--   -H "Content-Type: application/json" \
--   -d '{}'