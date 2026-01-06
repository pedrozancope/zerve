-- ============================================
-- Restore Basic System Configurations
-- ============================================
-- Restaura configurações básicas do sistema após reset do banco

-- Inserir configs globais (ignorar se já existirem)
DO $$
BEGIN
  -- unit_id
  IF NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'unit_id' AND user_id IS NULL) THEN
    INSERT INTO app_config (key, value, user_id) VALUES ('unit_id', '17686', NULL);
  END IF;
  
  -- condo_id
  IF NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'condo_id' AND user_id IS NULL) THEN
    INSERT INTO app_config (key, value, user_id) VALUES ('condo_id', '185', NULL);
  END IF;
  
  -- auth_token
  IF NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'auth_token' AND user_id IS NULL) THEN
    INSERT INTO app_config (key, value, user_id) VALUES ('auth_token', 'eyJhbGciOiJIUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJhMzIzM2U0NS0wYTk1LTRlMWMtYTg0OC0', NULL);
  END IF;
END $$;

-- Atualizar service_role_key (já foi criado pelas migrations anteriores)
UPDATE system_config 
SET value = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdmJzdXByamh2ZXNid3libXFjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjQxOTk3NCwiZXhwIjoyMDgxOTk1OTc0fQ.O8ANB9Lv_AOxpaawxQbD_7luwb0SKAFrtY7lZ1yu0QM' 
WHERE key = 'service_role_key';

-- Verificar o resultado
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM app_config WHERE user_id IS NULL;
  RAISE NOTICE '✅ Configurações globais restauradas: % configs', v_count;
  
  SELECT COUNT(*) INTO v_count FROM system_config WHERE key = 'service_role_key';
  IF v_count > 0 THEN
    RAISE NOTICE '✅ service_role_key configurada';
  ELSE
    RAISE WARNING '⚠️  service_role_key não encontrada';
  END IF;
END $$;
