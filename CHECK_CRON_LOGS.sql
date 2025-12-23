-- ============================================
-- Ver logs do pg_cron para debug
-- ============================================
-- 1. Ver se o cron está executando
SELECT
  *
FROM
  cron.job_run_details
WHERE
  jobid = 24
ORDER BY
  start_time DESC
LIMIT
  10;

-- 2. Ver últimas execuções com status
SELECT
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM
  cron.job_run_details
WHERE
  jobid = 24
ORDER BY
  start_time DESC
LIMIT
  5;