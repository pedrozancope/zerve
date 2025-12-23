-- Verificar últimas execuções do cron de preflight
SELECT
  runid,
  status,
  return_message,
  start_time,
  end_time
FROM
  cron.job_run_details
WHERE
  jobid = (
    SELECT
      jobid
    FROM
      cron.job
    WHERE
      jobname = 'preflight-check'
  )
ORDER BY
  start_time DESC
LIMIT
  3;