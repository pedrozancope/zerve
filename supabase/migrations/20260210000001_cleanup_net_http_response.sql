-- ============================================
-- Adicionar limpeza de net._http_response ao cleanup automático
-- Data: 10/02/2026
-- ============================================
--
-- PROBLEMA: A tabela net._http_response é o maior consumidor de storage
-- do banco (41 MB = 43.4% do total). Ela armazena as respostas de cada
-- chamada net.http_post() feita pelos cron jobs. Como todos os 3 jobs
-- que chamam Edge Functions (check_and_execute_schedules,
-- call_preflight_edge_function, run_auto_cancel_check) usam net.http_post,
-- as respostas se acumulam indefinidamente.
--
-- SOLUÇÃO: Adicionar limpeza dessa tabela ao cleanup automático diário
-- e executar limpeza imediata.
-- ============================================


-- ============================================
-- PARTE 1: Nova função para limpar net._http_response
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_net_http_response()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  -- Remove respostas HTTP do pg_net com mais de 3 dias
  -- Estas se acumulam com cada net.http_post() dos cron jobs
  DELETE FROM net._http_response
  WHERE created < NOW() - INTERVAL '3 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % registros de net._http_response removidos', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_net_http_response() IS 
  'Remove respostas HTTP armazenadas pelo pg_net com mais de 3 dias. Estas se acumulam com cada net.http_post() dos cron jobs.';


-- ============================================
-- PARTE 2: Atualizar run_automatic_cleanup() para incluir net._http_response
-- ============================================

CREATE OR REPLACE FUNCTION run_automatic_cleanup()
RETURNS TABLE(
  logs_deleted INTEGER,
  schedules_deleted INTEGER,
  reservations_deleted INTEGER,
  cleanup_timestamp TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  logs_count INTEGER;
  schedules_count INTEGER;
  reservations_count INTEGER;
  cron_details_count INTEGER;
  cleanup_history_count INTEGER;
  http_response_count INTEGER;
BEGIN
  -- Limpezas originais
  SELECT deleted_count INTO logs_count FROM cleanup_old_logs();
  SELECT deleted_count INTO schedules_count FROM cleanup_inactive_schedules();
  SELECT deleted_count INTO reservations_count FROM cleanup_old_reservations();
  
  -- Limpezas de tabelas internas (adicionadas em 20260210)
  SELECT deleted_count INTO cron_details_count FROM cleanup_cron_job_run_details();
  SELECT deleted_count INTO cleanup_history_count FROM cleanup_old_cleanup_history();
  SELECT deleted_count INTO http_response_count FROM cleanup_net_http_response();
  
  RAISE NOTICE 'Cleanup interno: % cron details, % http responses, % cleanup history removidos', 
    cron_details_count, http_response_count, cleanup_history_count;
  
  -- Registra no histórico
  BEGIN
    INSERT INTO cleanup_history (logs_deleted, schedules_deleted, reservations_deleted)
    VALUES (logs_count, schedules_count, reservations_count);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  
  RETURN QUERY SELECT 
    logs_count,
    schedules_count,
    reservations_count,
    NOW();
END;
$$;

COMMENT ON FUNCTION run_automatic_cleanup() IS 
  'Limpa logs (>14 dias), schedules inativos (>30 dias), reservations (>90 dias), cron.job_run_details (>3 dias), net._http_response (>3 dias) e cleanup_history (>90 dias). Roda diariamente às 3h.';


-- ============================================
-- PARTE 3: Limpeza imediata para liberar os ~41 MB acumulados
-- ============================================

-- net._http_response: o maior consumidor (41 MB / 43.4%)
DELETE FROM net._http_response
WHERE created < NOW() - INTERVAL '3 days';

-- Garantir que cron.job_run_details também está limpo (25 MB / 26.8%)
-- (A migration anterior já fez isso, mas reforçar para garantir)
DELETE FROM cron.job_run_details
WHERE end_time < NOW() - INTERVAL '3 days';


-- ============================================
-- Resumo:
-- ============================================
-- 1. Nova função cleanup_net_http_response() limpa respostas HTTP > 3 dias
-- 2. run_automatic_cleanup() atualizada para incluir net._http_response
-- 3. Limpeza imediata de ~66 MB acumulados (net._http_response + cron.job_run_details)
--
-- Impacto esperado: liberar ~60-65 MB imediatamente (~70% do storage total)
-- ============================================
