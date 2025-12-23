-- Pegar a service_role_key para usar no curl
SELECT
  value
FROM
  app_config
WHERE
  key = 'supabase_service_role_key';