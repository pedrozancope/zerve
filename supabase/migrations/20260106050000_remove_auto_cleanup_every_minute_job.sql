-- ============================================
-- Remove job auto-cleanup-every-minute (criado por engano)
-- ============================================
-- Este job estava rodando TODO MINUTO quando não deveria existir
-- 
-- NOTA: A função run_automatic_cleanup() foi removida no rollback 20260106000800
-- porque era uma função DIFERENTE da original (limpeza de logs antigos)
-- 
-- Jobs corretos que devem existir:
-- - 'automatic-cleanup' - limpa logs/schedules/reservations antigos (domingo 3h)
-- - 'check-trigger-date-schedules' - verifica schedules pendentes (todo minuto)
-- - 'auto-cancel-check' - verifica auto-cancel configs (todo minuto)
-- - 'preflight-check' - verifica preflights pendentes (todo minuto)
-- ============================================

DO $$
BEGIN
  -- Remover job que roda todo minuto (criado por engano)
  PERFORM cron.unschedule('auto-cleanup-every-minute');
  RAISE NOTICE 'Job auto-cleanup-every-minute removido';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Job auto-cleanup-every-minute não encontrado ou já foi removido';
END $$;

