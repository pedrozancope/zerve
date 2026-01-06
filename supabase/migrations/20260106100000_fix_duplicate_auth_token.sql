-- ============================================
-- Fix Duplicate auth_token Issue
-- ============================================
-- Remove o auth_token global (user_id = null) 
-- Manter apenas o token do usuário

DO $$
DECLARE
  v_user_token_count INTEGER;
  v_global_token_count INTEGER;
BEGIN
  -- Contar tokens
  SELECT COUNT(*) INTO v_user_token_count 
  FROM app_config 
  WHERE key = 'auth_token' AND user_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_global_token_count 
  FROM app_config 
  WHERE key = 'auth_token' AND user_id IS NULL;
  
  RAISE NOTICE 'Tokens encontrados: % do usuário, % global', v_user_token_count, v_global_token_count;
  
  -- Se existe token do usuário, deletar o global
  IF v_user_token_count > 0 AND v_global_token_count > 0 THEN
    DELETE FROM app_config 
    WHERE key = 'auth_token' AND user_id IS NULL;
    
    RAISE NOTICE '✅ Token global removido. Usando apenas token do usuário.';
  ELSIF v_global_token_count > 0 THEN
    RAISE NOTICE '⚠️  Apenas token global existe. Mantendo até usuário configurar o dele.';
  ELSIF v_user_token_count > 0 THEN
    RAISE NOTICE '✅ Apenas token do usuário existe. Nada a fazer.';
  ELSE
    RAISE NOTICE '⚠️  Nenhum token encontrado. Configure em Settings.';
  END IF;
END $$;

-- Verificar resultado final
SELECT 
  id,
  CASE 
    WHEN user_id IS NULL THEN 'GLOBAL'
    ELSE 'USER: ' || LEFT(user_id::text, 8)
  END as owner,
  key,
  LENGTH(value) as value_length,
  updated_at
FROM app_config
WHERE key = 'auth_token'
ORDER BY user_id NULLS FIRST;
