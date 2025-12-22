-- ============================================
-- SETUP: Configuração Inicial do Sistema
-- ============================================
-- Execute este script no SQL Editor do Supabase
-- ANTES de aplicar a migration 010
-- ============================================
-- ============================================
-- 1. CONFIGURAR VARIÁVEIS DO SISTEMA
-- ============================================
-- Substitua pelos valores do seu projeto Supabase
-- Você encontra esses valores em:
-- Project Settings > API > Project URL e service_role key
-- URL do seu projeto Supabase
ALTER DATABASE postgres
SET
  "app.settings.supabase_url" = 'https://ojvbsuprjhvesbwybmqc.supabase.co';

-- Service Role Key (NÃO é a anon key!)
-- ATENÇÃO: Esta é uma chave secreta, mantenha-a segura
ALTER DATABASE postgres
SET
  "app.settings.service_role_key" = 'SUA_SERVICE_ROLE_KEY_AQUI';

-- Chave de criptografia (para tokens sensíveis)
ALTER DATABASE postgres
SET
  "app.encryption_key" = 'sua-chave-de-criptografia-32-caracteres';

-- ============================================
-- 2. RECARREGAR CONFIGURAÇÕES
-- ============================================
-- Necessário para que as configurações entrem em vigor
SELECT
  pg_reload_conf ();

-- ============================================
-- 3. VERIFICAR CONFIGURAÇÕES
-- ============================================
-- Execute estas queries para verificar se está tudo certo:
SELECT
  'supabase_url' as config,
  current_setting ('app.settings.supabase_url', true) as value,
  CASE
    WHEN current_setting ('app.settings.supabase_url', true) IS NOT NULL THEN '✅ OK'
    ELSE '❌ NÃO CONFIGURADO'
  END as status;

SELECT
  'service_role_key' as config,
  CASE
    WHEN current_setting ('app.settings.service_role_key', true) IS NOT NULL THEN LEFT (
      current_setting ('app.settings.service_role_key', true),
      20
    ) || '...'
    ELSE NULL
  END as value,
  CASE
    WHEN current_setting ('app.settings.service_role_key', true) IS NOT NULL THEN '✅ OK'
    ELSE '❌ NÃO CONFIGURADO'
  END as status;

-- ============================================
-- 4. VERIFICAR EXTENSÕES
-- ============================================
SELECT
  extname,
  '✅ Instalada' as status
FROM
  pg_extension
WHERE
  extname IN ('pg_cron', 'pg_net', 'pgcrypto');

-- ============================================
-- 5. VERIFICAR SE pg_cron ESTÁ FUNCIONANDO
-- ============================================
SELECT
  jobid,
  jobname,
  schedule,
  active,
  '✅ Job ativo' as status
FROM
  cron.job
LIMIT
  5;