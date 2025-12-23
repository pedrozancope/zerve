-- Ver todos os logs de preflight recentes
SELECT
  id,
  schedule_id,
  status,
  message,
  execution_type,
  executed_at
FROM
  execution_logs
WHERE
  execution_type = 'preflight'
ORDER BY
  executed_at DESC
LIMIT
  5;