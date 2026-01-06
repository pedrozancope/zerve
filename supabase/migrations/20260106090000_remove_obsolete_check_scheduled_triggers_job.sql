-- ============================================
-- Remove Obsolete check-scheduled-triggers Job
-- ============================================
-- Remove o job antigo que chamava diretamente a Edge Function
-- Agora usamos check_and_execute_schedules() que é mais robusto

DO $$
BEGIN
  -- Tentar remover o job antigo
  PERFORM cron.unschedule('check-scheduled-triggers');
  RAISE NOTICE '✅ Job obsoleto "check-scheduled-triggers" removido';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Job "check-scheduled-triggers" não encontrado ou já removido';
END $$;

-- Verificar jobs ativos
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM cron.job WHERE active = true;
  RAISE NOTICE 'ℹ️  Jobs ativos após limpeza: %', v_count;
  RAISE NOTICE 'ℹ️  Jobs esperados: check_and_execute_schedules, call_preflight_edge_function, run_auto_cancel_check, run_automatic_cleanup';
END $$;
