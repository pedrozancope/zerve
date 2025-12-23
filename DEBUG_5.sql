-- Verificar se o campo flow_steps existe na tabela execution_logs
SELECT
  column_name,
  data_type
FROM
  information_schema.columns
WHERE
  table_name = 'execution_logs'
ORDER BY
  ordinal_position;