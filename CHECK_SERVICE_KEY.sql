-- ============================================
-- Verificar configuração da service_role_key
-- ============================================

-- 1. Ver se a configuração existe
SELECT * FROM app_config WHERE key LIKE '%service_role%';

-- 2. Se não existir, precisamos configurar (sem is_encrypted)
-- IMPORTANTE: Substitua YOUR_SERVICE_ROLE_KEY_HERE pela sua chave do Supabase
INSERT INTO app_config (key, value)
VALUES ('supabase_service_role_key', 'YOUR_SERVICE_ROLE_KEY_HERE')
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value;

-- 3. Ver logs recentes para debugar
SELECT * FROM execution_logs 
WHERE execution_type = 'preflight' 
ORDER BY executed_at DESC 
LIMIT 10;

-- 4. Ver detalhes do seu agendamento
SELECT 
  id,
  name,
  trigger_mode,
  trigger_datetime,
  trigger_time,
  trigger_day_of_week,
  preflight_enabled,
  preflight_hours_before,
  last_preflight_at,
  NOW() as current_time,
  trigger_datetime - (preflight_hours_before || ' hours')::INTERVAL as preflight_should_run_at
FROM schedules 
WHERE id = '025977c6-9e79-44b1-bb7e-a79be64cf94b';
