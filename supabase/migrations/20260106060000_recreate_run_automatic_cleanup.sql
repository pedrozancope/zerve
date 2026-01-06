-- ============================================
-- Recriar função run_automatic_cleanup() original
-- ============================================
-- Esta função limpa dados antigos do banco:
-- - Logs > 30 dias
-- - Schedules inativos > 30 dias  
-- - Reservations > 90 dias
-- ============================================

-- 1. Função para limpar logs antigos (> 30 dias)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS TABLE(deleted_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  DELETE FROM execution_logs
  WHERE executed_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % logs antigos removidos', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

-- 2. Função para limpar schedules inativos antigos (> 30 dias)
CREATE OR REPLACE FUNCTION cleanup_inactive_schedules()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  DELETE FROM schedules
  WHERE is_active = false
    AND updated_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % schedules inativos removidos', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

-- 3. Função para limpar reservations antigas (> 90 dias)
CREATE OR REPLACE FUNCTION cleanup_old_reservations()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  DELETE FROM reservations
  WHERE reservation_date < CURRENT_DATE - INTERVAL '90 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % reservations antigas removidas', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

-- 4. Função principal que executa toda a limpeza
CREATE OR REPLACE FUNCTION run_automatic_cleanup()
RETURNS TABLE(
  logs_deleted INTEGER,
  schedules_deleted INTEGER,
  reservations_deleted INTEGER,
  cleanup_timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  logs_count INTEGER;
  schedules_count INTEGER;
  reservations_count INTEGER;
BEGIN
  -- Executa todas as limpezas
  SELECT deleted_count INTO logs_count FROM cleanup_old_logs();
  SELECT deleted_count INTO schedules_count FROM cleanup_inactive_schedules();
  SELECT deleted_count INTO reservations_count FROM cleanup_old_reservations();
  
  -- Registra no histórico se a tabela existir
  BEGIN
    INSERT INTO cleanup_history (logs_deleted, schedules_deleted, reservations_deleted)
    VALUES (logs_count, schedules_count, reservations_count);
  EXCEPTION WHEN OTHERS THEN
    -- Ignorar se a tabela não existir
    NULL;
  END;
  
  -- Retorna o resultado
  RETURN QUERY SELECT 
    logs_count,
    schedules_count,
    reservations_count,
    NOW();
END;
$$;

-- 5. Verificar se o cron job existe, se não, criar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'automatic-cleanup') THEN
    PERFORM cron.schedule(
      'automatic-cleanup',
      '0 3 * * 0', -- Todo domingo às 3h
      'SELECT run_automatic_cleanup();'
    );
    RAISE NOTICE 'Cron job automatic-cleanup criado';
  ELSE
    RAISE NOTICE 'Cron job automatic-cleanup já existe';
  END IF;
END $$;

-- 6. Comentários
COMMENT ON FUNCTION run_automatic_cleanup() IS 
  'Limpa logs antigos (>30 dias), schedules inativos (>30 dias) e reservations antigas (>90 dias). Roda automaticamente via cron job "automatic-cleanup" todo domingo às 3h.';

COMMENT ON FUNCTION cleanup_old_logs() IS 
  'Remove logs de execução com mais de 30 dias';

COMMENT ON FUNCTION cleanup_inactive_schedules() IS 
  'Remove schedules inativos há mais de 30 dias';

COMMENT ON FUNCTION cleanup_old_reservations() IS 
  'Remove reservations com mais de 90 dias';

