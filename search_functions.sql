-- ============================================
-- Diagnóstico de Problema com app_config
-- ============================================

-- 1. Verificar estrutura da tabela app_config
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'app_config'
ORDER BY ordinal_position;

-- 2. Verificar constraints e índices
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'app_config'::regclass;

-- 3. Verificar políticas RLS
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'app_config';

-- 4. Verificar se RLS está habilitado
SELECT 
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' 
  AND tablename = 'app_config';

-- 5. Ver dados atuais de auth_token
SELECT 
  id,
  user_id,
  key,
  LENGTH(value) as value_length,
  LEFT(value, 20) as value_preview,
  updated_at
FROM app_config
WHERE key = 'auth_token';
