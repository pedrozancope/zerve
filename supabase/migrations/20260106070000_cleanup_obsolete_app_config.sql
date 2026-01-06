-- ============================================
-- Limpar configs obsoletas de app_config
-- ============================================
-- Remove configs que não são mais usadas pela aplicação
-- ============================================

DO $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Remover configs antigas do auto_cancel (agora usa tabela auto_cancel_config)
  -- E remover supabase_service_role_key (migrado para system_config)
  DELETE FROM app_config 
  WHERE key IN (
    'auto_cancel_enabled',
    'auto_cancel_time',
    'auto_cancel_reason',
    'auto_cancel_notify_success',
    'auto_cancel_notify_failure',
    'auto_cancel_dry_run',
    'supabase_service_role_key'
  );
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Removidas % configs obsoletas', v_deleted_count;
  RAISE NOTICE 'ℹ️  Configs que permaneceram em app_config:';
  RAISE NOTICE '   - unit_id, condo_id (configs globais do sistema)';
  RAISE NOTICE '   - notification_email (config por usuário)';
  RAISE NOTICE '   - auth_token (token de autenticação SuperLogica)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Nota: supabase_service_role_key agora está em system_config';
END $$;


-- Comentário sobre supabase_service_role_key
-- NOTA: supabase_service_role_key em app_config está deprecated
-- O valor correto deve estar em system_config.service_role_key
-- Verificar se ainda é usado antes de remover

