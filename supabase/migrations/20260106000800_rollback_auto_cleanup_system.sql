-- ============================================
-- ROLLBACK: Remover completamente o sistema de Auto-Cleanup
-- ============================================
-- Remove todas as alterações feitas nas migrations:
-- - 20260105220000_add_auto_cleanup_system.sql
-- - 20260105220001_fix_auto_cleanup_cron_function.sql
-- - 20260106000000_simplify_auto_cleanup_cron.sql
-- - 20260106000100_add_notify_on_zero_reservations.sql
-- - 20260106000200_fix_auto_cleanup_cron_function.sql
-- - 20260106000201_ensure_anon_key_config.sql
-- - 20260106000300_simplify_auto_cleanup_http_call.sql
-- - 20260106000400_change_cron_to_every_minute.sql
-- - 20260106000500_add_debugging_to_auto_cleanup.sql
-- - 20260106000600_fix_ambiguous_user_id.sql
-- - 20260106000700_replicate_schedule_pattern_for_cleanup.sql
-- ============================================

-- 1. Remover cron jobs relacionados ao auto-cleanup
DO $$
BEGIN
  -- Remove todos os jobs relacionados
  PERFORM cron.unschedule('auto-cleanup-hourly-check');
  PERFORM cron.unschedule('auto-cleanup-every-minute');
  RAISE NOTICE 'Cron jobs de auto-cleanup removidos';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Alguns jobs não existiam: %', SQLERRM;
END $$;

-- 2. Remover função run_automatic_cleanup
DROP FUNCTION IF EXISTS run_automatic_cleanup() CASCADE;

-- 3. Remover tabela auto_cleanup_config e relacionados
DROP TABLE IF EXISTS auto_cleanup_config CASCADE;

-- 4. Remover políticas RLS (se existirem)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can view their own auto_cleanup_config" ON auto_cleanup_config;
  DROP POLICY IF EXISTS "Users can update their own auto_cleanup_config" ON auto_cleanup_config;
  DROP POLICY IF EXISTS "Users can insert their own auto_cleanup_config" ON auto_cleanup_config;
  DROP POLICY IF EXISTS "Users can delete their own auto_cleanup_config" ON auto_cleanup_config;
  RAISE NOTICE 'Políticas RLS removidas';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Algumas políticas não existiam: %', SQLERRM;
END $$;

-- 5. Remover índices relacionados (se existirem)
DROP INDEX IF EXISTS idx_auto_cleanup_config_user_id;
DROP INDEX IF EXISTS idx_auto_cleanup_config_enabled;
DROP INDEX IF EXISTS idx_auto_cleanup_config_last_run_at;

-- Confirmação
DO $$
BEGIN
  RAISE NOTICE '✅ Rollback do sistema de Auto-Cleanup concluído';
  RAISE NOTICE '⚠️  AÇÃO MANUAL NECESSÁRIA: Remova a Edge Function "run-post-reservation-cleanup" via Dashboard ou CLI';
END $$;
