-- ============================================
-- CLEANUP: Remover Tabelas e Triggers Órfãos
-- ============================================
-- Remove dead code identificado durante validação:
-- 
-- TABELAS ÓRFÃS:
-- 1. notifications - nunca recebe INSERTs em Edge Functions (0 registros)
-- 2. auto_cleanup_history - Edge Function "run-post-reservation-cleanup" nunca criada
-- 
-- TRIGGERS ÓRFÃOS (Dead Code):
-- 3. on_schedule_delete - depende de pg_cron_job_id que nunca é populado
-- 4. on_schedule_active_change - depende de pg_cron_job_id que nunca é populado
-- 5. auto_cancel_config_manage_cron - sistema usa polling global, não jobs individuais
-- 6. auto_cancel_config_remove_cron - sistema usa polling global, não jobs individuais
-- 
-- FUNÇÕES ÓRFÃS (Dead Code):
-- 7. trigger_delete_schedule_cron_job() - função do trigger órfão
-- 8. trigger_schedule_active_change() - função do trigger órfão
-- 9. create_schedule_cron_job() - nunca usada (sistema usa polling global)
-- 10. delete_schedule_cron_job() - nunca usada (sistema usa polling global)
-- 11. update_schedule_cron_job() - nunca usada (sistema usa polling global)
--
-- CONTEXT: Sistema usa arquitetura de polling global (4 jobs verificam tabelas a cada minuto)
--          ao invés de criar jobs pg_cron individuais por schedule/auto_cancel
-- ============================================

-- ============================================
-- 1. REMOVER TABELAS ÓRFÃS
-- ============================================

-- 1.1. Remover tabela notifications (nunca usada)
DROP TABLE IF EXISTS notifications CASCADE;

-- 1.2. Remover tabela auto_cleanup_history (Edge Function nunca criada)
DROP TABLE IF EXISTS auto_cleanup_history CASCADE;

-- ============================================
-- 2. REMOVER TRIGGERS ÓRFÃOS
-- ============================================

-- 2.1. Trigger: on_schedule_delete (depende de pg_cron_job_id)
DROP TRIGGER IF EXISTS on_schedule_delete ON schedules;

-- 2.2. Trigger: on_schedule_active_change (depende de pg_cron_job_id)
DROP TRIGGER IF EXISTS on_schedule_active_change ON schedules;

-- 2.3. Trigger: auto_cancel_config_manage_cron (não usado - sistema usa polling)
DROP TRIGGER IF EXISTS auto_cancel_config_manage_cron ON auto_cancel_config;

-- 2.4. Trigger: auto_cancel_config_remove_cron (não usado - sistema usa polling)
DROP TRIGGER IF EXISTS auto_cancel_config_remove_cron ON auto_cancel_config;

-- ============================================
-- 3. REMOVER FUNÇÕES ÓRFÃS
-- ============================================

-- 3.1. Funções de trigger órfãos
DROP FUNCTION IF EXISTS trigger_delete_schedule_cron_job() CASCADE;
DROP FUNCTION IF EXISTS trigger_schedule_active_change() CASCADE;
DROP FUNCTION IF EXISTS manage_auto_cancel_cron_job() CASCADE;
DROP FUNCTION IF EXISTS remove_auto_cancel_cron_job() CASCADE;

-- 3.2. Funções de gerenciamento de cron job (nunca usadas)
DROP FUNCTION IF EXISTS create_schedule_cron_job(
  p_schedule_id UUID,
  p_cron_expression TEXT,
  p_edge_function_url TEXT
) CASCADE;

DROP FUNCTION IF EXISTS delete_schedule_cron_job(p_job_id BIGINT) CASCADE;

DROP FUNCTION IF EXISTS update_schedule_cron_job(
  p_job_id BIGINT,
  p_cron_expression TEXT
) CASCADE;

-- ============================================
-- 4. REMOVER ÍNDICES ÓRFÃOS
-- ============================================

-- Índice baseado em pg_cron_job_id (campo nunca populado)
DROP INDEX IF EXISTS idx_schedules_pg_cron_job_id;

-- Índices da tabela notifications (removida)
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP INDEX IF EXISTS idx_notifications_status;

-- Índices da tabela auto_cleanup_history (removida)
DROP INDEX IF EXISTS idx_auto_cleanup_history_user;
DROP INDEX IF EXISTS idx_auto_cleanup_history_date;
DROP INDEX IF EXISTS idx_auto_cleanup_history_status;

-- ============================================
-- 5. OPCIONAL: REMOVER CAMPO pg_cron_job_id (COMENTADO)
-- ============================================
-- Este campo nunca é populado pois sistema usa polling global
-- Mantido por enquanto para evitar breaking changes em migrations antigas
-- Se quiser remover, descomente:
-- 
-- ALTER TABLE schedules DROP COLUMN IF EXISTS pg_cron_job_id;
-- ALTER TABLE auto_cancel_config DROP COLUMN IF EXISTS pg_cron_job_id;

-- ============================================
-- 6. CONFIRMAÇÃO E DOCUMENTAÇÃO
-- ============================================

-- Adicionar comentários explicando por que foram removidos
COMMENT ON SCHEMA public IS 
  'Cleanup executado em 2026-01-06: Removidas 2 tabelas órfãs (notifications, auto_cleanup_history), 4 triggers dead code, e 7 funções não usadas. Sistema usa polling global ao invés de jobs pg_cron individuais.';

-- Log de confirmação
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup concluído com sucesso';
  RAISE NOTICE '';
  RAISE NOTICE 'TABELAS REMOVIDAS:';
  RAISE NOTICE '  - notifications (0 registros, nunca usada)';
  RAISE NOTICE '  - auto_cleanup_history (Edge Function nunca criada)';
  RAISE NOTICE '';
  RAISE NOTICE 'TRIGGERS REMOVIDOS:';
  RAISE NOTICE '  - on_schedule_delete';
  RAISE NOTICE '  - on_schedule_active_change';
  RAISE NOTICE '  - auto_cancel_config_manage_cron';
  RAISE NOTICE '  - auto_cancel_config_remove_cron';
  RAISE NOTICE '';
  RAISE NOTICE 'FUNÇÕES REMOVIDAS:';
  RAISE NOTICE '  - trigger_delete_schedule_cron_job()';
  RAISE NOTICE '  - trigger_schedule_active_change()';
  RAISE NOTICE '  - manage_auto_cancel_cron_job()';
  RAISE NOTICE '  - remove_auto_cancel_cron_job()';
  RAISE NOTICE '  - create_schedule_cron_job()';
  RAISE NOTICE '  - delete_schedule_cron_job()';
  RAISE NOTICE '  - update_schedule_cron_job()';
  RAISE NOTICE '';
  RAISE NOTICE 'ÍNDICES REMOVIDOS:';
  RAISE NOTICE '  - idx_schedules_pg_cron_job_id';
  RAISE NOTICE '  - idx_notifications_* (3 índices)';
  RAISE NOTICE '  - idx_auto_cleanup_history_* (3 índices)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Total: 2 tabelas, 4 triggers, 7 funções, 7 índices';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  CAMPOS MANTIDOS (por compatibilidade):';
  RAISE NOTICE '  - schedules.pg_cron_job_id (NULL sempre)';
  RAISE NOTICE '  - auto_cancel_config.pg_cron_job_id (NULL sempre)';
  RAISE NOTICE '';
  RAISE NOTICE 'ℹ️  Sistema usa arquitetura de POLLING GLOBAL:';
  RAISE NOTICE '  - check_and_execute_schedules() (every minute)';
  RAISE NOTICE '  - run_auto_cancel_check() (every minute)';
  RAISE NOTICE '  - call_preflight_edge_function() (every minute)';
  RAISE NOTICE '  - run_automatic_cleanup() (weekly)';
END $$;
