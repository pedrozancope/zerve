-- 1. Verificar o que já existe
SELECT
  'app_config existentes:' as info;

SELECT
  key,
  user_id
FROM
  app_config
ORDER BY
  key;

SELECT
  'system_config existentes:' as info;

SELECT
  key
FROM
  system_config
ORDER BY
  key;

-- 2. Inserir apenas as configs que faltam (ignorar duplicatas)
INSERT INTO
  app_config (key, value, user_id)
VALUES
  ('unit_id', '17686', NULL),
  ('condo_id', '185', NULL),
  ('auth_token', 'SEU_TOKEN_SUPERLOGICA', NULL) ON CONFLICT (
    key,
    COALESCE(user_id, '00000000-0000-0000-0000-000000000000')
  ) DO NOTHING;

-- 3. Atualizar service_role_key se necessário
UPDATE system_config
SET
  value = 'SUA_SERVICE_ROLE_KEY'
WHERE
  key = 'service_role_key';

-- 4. Verificar o resultado final
SELECT
  'Configs finais:' as info;

SELECT
  key,
  CASE
    WHEN key = 'auth_token' THEN '***'
    ELSE LEFT (value, 20)
  END as value_preview
FROM
  app_config
WHERE
  user_id IS NULL
ORDER BY
  key;