-- ============================================
-- HOTFIX: Corrigir search_path das funções para 'public'
-- Data: 07/01/2026
-- ============================================
-- PROBLEMA: A migration 20260107000001_fix_function_search_path.sql
-- definiu search_path = '' (vazio) em todas as funções, impedindo
-- que elas acessem as tabelas do schema public.
--
-- SOLUÇÃO: Alterar search_path de '' para 'public' em todas as funções.
--
-- IMPACTO: Restaura funcionalidade de todos os agendamentos
-- ============================================

DO $$
DECLARE
  functions_fixed INTEGER := 0;
BEGIN
  RAISE NOTICE '🔧 Iniciando correção do search_path...';

  -- 1. call_preflight_edge_function
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'call_preflight_edge_function') THEN
    EXECUTE 'ALTER FUNCTION call_preflight_edge_function() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ call_preflight_edge_function';
  END IF;

  -- 2. check_and_execute_schedules
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_and_execute_schedules') THEN
    EXECUTE 'ALTER FUNCTION check_and_execute_schedules() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ check_and_execute_schedules';
  END IF;

  -- 3. cleanup_inactive_schedules
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_inactive_schedules') THEN
    EXECUTE 'ALTER FUNCTION cleanup_inactive_schedules() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ cleanup_inactive_schedules';
  END IF;

  -- 4. cleanup_old_logs
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_logs') THEN
    EXECUTE 'ALTER FUNCTION cleanup_old_logs() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ cleanup_old_logs';
  END IF;

  -- 5. cleanup_old_reservations
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_reservations') THEN
    EXECUTE 'ALTER FUNCTION cleanup_old_reservations() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ cleanup_old_reservations';
  END IF;

  -- 6. decrypt_value
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_value') THEN
    EXECUTE 'ALTER FUNCTION decrypt_value(TEXT) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ decrypt_value';
  END IF;

  -- 7. encrypt_value
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_value') THEN
    EXECUTE 'ALTER FUNCTION encrypt_value(TEXT) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ encrypt_value';
  END IF;

  -- 8. execute_pending_trigger_date_schedules
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'execute_pending_trigger_date_schedules') THEN
    EXECUTE 'ALTER FUNCTION execute_pending_trigger_date_schedules() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ execute_pending_trigger_date_schedules';
  END IF;

  -- 9. get_config_default
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_config_default') THEN
    EXECUTE 'ALTER FUNCTION get_config_default(TEXT) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ get_config_default';
  END IF;

  -- 10. get_decrypted_config
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_decrypted_config') THEN
    EXECUTE 'ALTER FUNCTION get_decrypted_config(TEXT) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ get_decrypted_config';
  END IF;

  -- 11. get_system_config
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_system_config') THEN
    EXECUTE 'ALTER FUNCTION get_system_config(TEXT) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ get_system_config';
  END IF;

  -- 12. get_utc_hour_from_brt
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_utc_hour_from_brt') THEN
    EXECUTE 'ALTER FUNCTION get_utc_hour_from_brt(TIME) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ get_utc_hour_from_brt';
  END IF;

  -- 13. is_speed_token_valid
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_speed_token_valid') THEN
    EXECUTE 'ALTER FUNCTION is_speed_token_valid() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ is_speed_token_valid';
  END IF;

  -- 14. manage_auto_cancel_delete_cron_job
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'manage_auto_cancel_delete_cron_job') THEN
    EXECUTE 'ALTER FUNCTION manage_auto_cancel_delete_cron_job() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ manage_auto_cancel_delete_cron_job';
  END IF;

  -- 15. run_auto_cancel_check
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_auto_cancel_check') THEN
    EXECUTE 'ALTER FUNCTION run_auto_cancel_check() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ run_auto_cancel_check';
  END IF;

  -- 16. run_automatic_cleanup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_automatic_cleanup') THEN
    EXECUTE 'ALTER FUNCTION run_automatic_cleanup() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ run_automatic_cleanup';
  END IF;

  -- 17. test_schedule_execution
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'test_schedule_execution') THEN
    EXECUTE 'ALTER FUNCTION test_schedule_execution(UUID) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ test_schedule_execution';
  END IF;

  -- 18. trigger_reset_preflight_on_config_change
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_reset_preflight_on_config_change') THEN
    EXECUTE 'ALTER FUNCTION trigger_reset_preflight_on_config_change() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ trigger_reset_preflight_on_config_change';
  END IF;

  -- 19. trigger_reset_preflight_on_datetime_change
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_reset_preflight_on_datetime_change') THEN
    EXECUTE 'ALTER FUNCTION trigger_reset_preflight_on_datetime_change() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ trigger_reset_preflight_on_datetime_change';
  END IF;

  -- 20. update_auto_cleanup_config_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_auto_cleanup_config_updated_at') THEN
    EXECUTE 'ALTER FUNCTION update_auto_cleanup_config_updated_at() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ update_auto_cleanup_config_updated_at';
  END IF;

  -- 21. update_updated_at_column
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'ALTER FUNCTION update_updated_at_column() SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ update_updated_at_column';
  END IF;

  -- 22. check_schedule_needs_preflight (pode ter diferentes assinaturas)
  BEGIN
    EXECUTE 'ALTER FUNCTION check_schedule_needs_preflight(UUID, TIMESTAMP WITH TIME ZONE) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ check_schedule_needs_preflight(UUID, TIMESTAMP)';
  EXCEPTION WHEN undefined_function THEN
    BEGIN
      EXECUTE 'ALTER FUNCTION check_schedule_needs_preflight(UUID) SET search_path = public';
      functions_fixed := functions_fixed + 1;
      RAISE NOTICE '✅ check_schedule_needs_preflight(UUID)';
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END;

  -- 23. upsert_encrypted_config (pode ter diferentes assinaturas)
  BEGIN
    EXECUTE 'ALTER FUNCTION upsert_encrypted_config(UUID, TEXT, TEXT) SET search_path = public';
    functions_fixed := functions_fixed + 1;
    RAISE NOTICE '✅ upsert_encrypted_config(UUID, TEXT, TEXT)';
  EXCEPTION WHEN undefined_function THEN
    BEGIN
      EXECUTE 'ALTER FUNCTION upsert_encrypted_config(TEXT, TEXT) SET search_path = public';
      functions_fixed := functions_fixed + 1;
      RAISE NOTICE '✅ upsert_encrypted_config(TEXT, TEXT)';
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ HOTFIX CONCLUÍDO!';
  RAISE NOTICE '📊 Funções corrigidas: %', functions_fixed;
  RAISE NOTICE '🔧 search_path alterado de "" para "public"';
  RAISE NOTICE '============================================';
END $$;
