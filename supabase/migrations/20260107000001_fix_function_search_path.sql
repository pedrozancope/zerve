-- ============================================
-- Fix Function Search Path Mutable Warnings
-- Data: 07/01/2026
-- ============================================
-- Este script adiciona search_path explícito em 23 funções SQL
-- para prevenir ataques de "search path injection".
--
-- ESTRATÉGIA: Usar ALTER FUNCTION com verificação de existência
-- para evitar erros em funções que não existem
--
-- IMPACTO: Baixíssimo - apenas adiciona proteção de segurança
-- BREAKING CHANGES: Nenhum
-- ============================================

DO $$
DECLARE
  functions_updated INTEGER := 0;
BEGIN
  -- 1. update_updated_at_column
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    EXECUTE 'ALTER FUNCTION update_updated_at_column() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 2. get_utc_hour_from_brt
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_utc_hour_from_brt') THEN
    EXECUTE 'ALTER FUNCTION get_utc_hour_from_brt(TIME) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 3. get_config_default
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_config_default') THEN
    EXECUTE 'ALTER FUNCTION get_config_default(TEXT) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 4. get_system_config
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_system_config') THEN
    EXECUTE 'ALTER FUNCTION get_system_config(TEXT) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 5. encrypt_value
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'encrypt_value') THEN
    EXECUTE 'ALTER FUNCTION encrypt_value(TEXT) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 6. decrypt_value
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrypt_value') THEN
    EXECUTE 'ALTER FUNCTION decrypt_value(TEXT) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 7. upsert_encrypted_config (pode ter assinatura diferente)
  BEGIN
    EXECUTE 'ALTER FUNCTION upsert_encrypted_config(UUID, TEXT, TEXT) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  EXCEPTION WHEN undefined_function THEN
    -- Tenta assinatura alternativa
    BEGIN
      EXECUTE 'ALTER FUNCTION upsert_encrypted_config(TEXT, TEXT) SET search_path = ''''';
      functions_updated := functions_updated + 1;
    EXCEPTION WHEN undefined_function THEN
      NULL; -- Função não existe
    END;
  END;

  -- 8. get_decrypted_config
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_decrypted_config') THEN
    EXECUTE 'ALTER FUNCTION get_decrypted_config(TEXT) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 9. is_speed_token_valid
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_speed_token_valid') THEN
    EXECUTE 'ALTER FUNCTION is_speed_token_valid() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 10. cleanup_old_logs
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_logs') THEN
    EXECUTE 'ALTER FUNCTION cleanup_old_logs() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 11. cleanup_inactive_schedules
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_inactive_schedules') THEN
    EXECUTE 'ALTER FUNCTION cleanup_inactive_schedules() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 12. cleanup_old_reservations
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_reservations') THEN
    EXECUTE 'ALTER FUNCTION cleanup_old_reservations() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 13. run_automatic_cleanup
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_automatic_cleanup') THEN
    EXECUTE 'ALTER FUNCTION run_automatic_cleanup() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 14. update_auto_cleanup_config_updated_at
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_auto_cleanup_config_updated_at') THEN
    EXECUTE 'ALTER FUNCTION update_auto_cleanup_config_updated_at() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 15. check_and_execute_schedules
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_and_execute_schedules') THEN
    EXECUTE 'ALTER FUNCTION check_and_execute_schedules() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 16. execute_pending_trigger_date_schedules
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'execute_pending_trigger_date_schedules') THEN
    EXECUTE 'ALTER FUNCTION execute_pending_trigger_date_schedules() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 17. test_schedule_execution
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'test_schedule_execution') THEN
    EXECUTE 'ALTER FUNCTION test_schedule_execution(UUID) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 18. check_schedule_needs_preflight
  BEGIN
    EXECUTE 'ALTER FUNCTION check_schedule_needs_preflight(UUID, TIMESTAMP WITH TIME ZONE) SET search_path = ''''';
    functions_updated := functions_updated + 1;
  EXCEPTION WHEN undefined_function THEN
    -- Tenta sem segundo parâmetro
    BEGIN
      EXECUTE 'ALTER FUNCTION check_schedule_needs_preflight(UUID) SET search_path = ''''';
      functions_updated := functions_updated + 1;
    EXCEPTION WHEN undefined_function THEN
      NULL;
    END;
  END;

  -- 19. call_preflight_edge_function
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'call_preflight_edge_function') THEN
    EXECUTE 'ALTER FUNCTION call_preflight_edge_function() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 20. trigger_reset_preflight_on_config_change
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_reset_preflight_on_config_change') THEN
    EXECUTE 'ALTER FUNCTION trigger_reset_preflight_on_config_change() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 21. trigger_reset_preflight_on_datetime_change
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_reset_preflight_on_datetime_change') THEN
    EXECUTE 'ALTER FUNCTION trigger_reset_preflight_on_datetime_change() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 22. run_auto_cancel_check
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'run_auto_cancel_check') THEN
    EXECUTE 'ALTER FUNCTION run_auto_cancel_check() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  -- 23. manage_auto_cancel_delete_cron_job
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'manage_auto_cancel_delete_cron_job') THEN
    EXECUTE 'ALTER FUNCTION manage_auto_cancel_delete_cron_job() SET search_path = ''''';
    functions_updated := functions_updated + 1;
  END IF;

  RAISE NOTICE '✅ Migration 20260107000001_fix_function_search_path.sql concluída!';
  RAISE NOTICE '📊 Funções atualizadas: %/23', functions_updated;
  RAISE NOTICE '🔒 Search path protegido em todas as funções encontradas';
END $$;
