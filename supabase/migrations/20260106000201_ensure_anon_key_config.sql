-- Verificar se anon_key está configurada em app_config
-- Se não estiver, adiciona um placeholder para ser preenchido manualmente

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Pegar o primeiro user_id com config
  SELECT user_id INTO v_user_id
  FROM app_config
  LIMIT 1;

  -- Verificar se anon_key já existe
  IF NOT EXISTS (SELECT 1 FROM app_config WHERE key = 'anon_key') THEN
    IF v_user_id IS NOT NULL THEN
      INSERT INTO app_config (user_id, key, value, updated_at)
      VALUES (
        v_user_id, 
        'anon_key', 
        'CONFIGURE_WITH_ANON_KEY_FROM_SUPABASE_SETTINGS', 
        NOW()
      )
      ON CONFLICT (user_id, key) DO NOTHING;
      RAISE NOTICE 'anon_key config created - please update with actual key from Supabase Settings';
    ELSE
      RAISE WARNING 'No user found in app_config to insert anon_key';
    END IF;
  ELSE
    RAISE NOTICE 'anon_key already exists in app_config';
  END IF;
END $$;
