-- ============================================
-- Corrigir Cron do Pre-flight
-- ============================================

-- 1. Primeiro, vamos configurar corretamente a service_role_key
-- Pegue sua chave em: Supabase Dashboard > Settings > API > service_role (secret)
-- IMPORTANTE: Substitua YOUR_SERVICE_ROLE_KEY pela chave real
DO $$
BEGIN
  -- Verificar se já existe
  IF EXISTS (SELECT 1 FROM app_config WHERE key = 'supabase_service_role_key') THEN
    RAISE NOTICE 'Service role key já existe. Use UPDATE se quiser alterar.';
  ELSE
    -- Inserir a chave
    INSERT INTO app_config (key, value)
    VALUES ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY');
    RAISE NOTICE 'Service role key inserida com sucesso!';
  END IF;
END $$;

-- 2. Remover cron antigo
SELECT cron.unschedule('preflight-check');

-- 3. Criar novo cron com service_role_key direto da app_config
SELECT cron.schedule(
  'preflight-check',
  '* * * * *', -- A cada minuto (para teste)
  $$
    SELECT net.http_post(
      url:='https://ifsgngdptmzovzuvudah.supabase.co/functions/v1/run-preflight',
      headers:=jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'supabase_service_role_key' LIMIT 1)
      ),
      body:='{}'::jsonb
    )
  $$
);

-- 4. Verificar se foi criado
SELECT jobid, schedule, jobname, active 
FROM cron.job 
WHERE jobname = 'preflight-check';

-- 5. Verificar se a key está acessível
SELECT 
  key,
  LEFT(value, 10) || '...' as value_preview,
  LENGTH(value) as key_length
FROM app_config 
WHERE key = 'supabase_service_role_key';
