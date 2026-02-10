-- ============================================
-- Otimizar Preflight (eliminar invocações desnecessárias) e reduzir Storage
-- Data: 10/02/2026
-- ============================================
--
-- PROBLEMA 1: A Edge Function "run-preflight" é invocada 1440x/dia (todo minuto)
-- consumindo quota de Edge Function Invocations.
--
-- CAUSA RAIZ: Diferente dos outros jobs (check_and_execute_schedules,
-- run_auto_cancel_check) que fazem toda a filtragem em SQL e só chamam
-- a Edge Function quando necessário, a call_preflight_edge_function()
-- é um "proxy burro" que SEMPRE dispara net.http_post sem nenhuma condição.
--
-- SOLUÇÃO: Reescrever call_preflight_edge_function() para replicar o mesmo
-- padrão dos outros jobs — fazer o filtro em SQL primeiro e só chamar a
-- Edge Function quando existir pelo menos 1 schedule que precisa de preflight.
-- O cron continua '* * * * *' (para não perder janelas), mas as invocações
-- reais da Edge Function caem de ~1440/dia para ~1-5/dia.
--
-- PROBLEMA 2: O storage do banco está crescendo excessivamente.
-- Causa principal: a tabela cron.job_run_details acumula registros de CADA
-- execução de cron job (4 jobs × 1440 min = ~5760 registros/dia que nunca
-- são limpos).
--
-- SOLUÇÃO: Adicionar limpeza de cron.job_run_details ao cleanup automático,
-- aumentar frequência do cleanup para diário e reduzir retenção de logs.
-- ============================================


-- ============================================
-- PARTE 1: Reescrever call_preflight_edge_function() com pré-filtragem em SQL
-- (mesmo padrão de check_and_execute_schedules e run_auto_cancel_check)
-- ============================================

CREATE OR REPLACE FUNCTION call_preflight_edge_function()
RETURNS jsonb AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_key TEXT;
  v_request_id BIGINT;
  v_now TIMESTAMPTZ := NOW();
  v_schedule RECORD;
  v_needs_preflight BOOLEAN := FALSE;
  v_trigger_dt TIMESTAMPTZ;
  v_preflight_start TIMESTAMPTZ;
  v_preflight_end TIMESTAMPTZ;
  v_next_trigger TIMESTAMPTZ;
  v_hours_before INTEGER;
  v_trigger_time_parts TEXT[];
  v_trigger_hour INTEGER;
  v_trigger_minute INTEGER;
  v_current_dow INTEGER;
  v_days_until INTEGER;
BEGIN
  -- ============================================
  -- PASSO 1: Verificar se existe algum schedule que precisa de preflight AGORA
  -- Isso evita chamar a Edge Function desnecessariamente
  -- ============================================
  FOR v_schedule IN
    SELECT 
      id, name, trigger_mode, trigger_datetime, 
      trigger_day_of_week, trigger_time,
      preflight_hours_before, last_preflight_at
    FROM schedules
    WHERE is_active = TRUE
      AND preflight_enabled = TRUE
  LOOP
    v_hours_before := COALESCE(v_schedule.preflight_hours_before, 4);
    
    IF v_schedule.trigger_mode = 'trigger_date' AND v_schedule.trigger_datetime IS NOT NULL THEN
      -- Modo trigger_date: janela de 10 min antes do trigger - hours_before
      v_trigger_dt := v_schedule.trigger_datetime;
      v_preflight_start := v_trigger_dt - (v_hours_before || ' hours')::INTERVAL;
      v_preflight_end := v_preflight_start + INTERVAL '10 minutes';
      
      IF v_now >= v_preflight_start AND v_now < v_preflight_end THEN
        -- Verificar se já executou nos últimos 15 minutos
        IF v_schedule.last_preflight_at IS NULL 
           OR v_schedule.last_preflight_at < v_now - INTERVAL '15 minutes' THEN
          v_needs_preflight := TRUE;
          EXIT; -- Já encontrou um, não precisa continuar
        END IF;
      END IF;
      
    ELSIF v_schedule.trigger_mode = 'reservation_date' THEN
      -- Modo reservation_date: calcular próximo trigger baseado em dia/hora
      v_trigger_time_parts := string_to_array(COALESCE(v_schedule.trigger_time::text, '00:01:00'), ':');
      v_trigger_hour := COALESCE(v_trigger_time_parts[1]::INTEGER, 0);
      v_trigger_minute := COALESCE(v_trigger_time_parts[2]::INTEGER, 1);
      
      v_current_dow := EXTRACT(DOW FROM v_now)::INTEGER;
      v_days_until := v_schedule.trigger_day_of_week - v_current_dow;
      IF v_days_until < 0 THEN v_days_until := v_days_until + 7; END IF;
      
      v_next_trigger := date_trunc('day', v_now) + (v_days_until || ' days')::INTERVAL
                        + make_interval(hours := v_trigger_hour, mins := v_trigger_minute);
      
      -- Se o trigger é hoje mas já passou, próxima semana
      IF v_days_until = 0 AND v_next_trigger <= v_now THEN
        v_next_trigger := v_next_trigger + INTERVAL '7 days';
      END IF;
      
      v_preflight_start := v_next_trigger - (v_hours_before || ' hours')::INTERVAL;
      v_preflight_end := v_preflight_start + INTERVAL '10 minutes';
      
      IF v_now >= v_preflight_start AND v_now < v_preflight_end THEN
        -- Verificar se já executou recentemente
        v_hours_before := COALESCE(v_schedule.preflight_hours_before, 4);
        IF v_schedule.last_preflight_at IS NULL 
           OR v_schedule.last_preflight_at < v_now - INTERVAL '15 minutes' THEN
          v_needs_preflight := TRUE;
          EXIT;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- ============================================
  -- PASSO 2: Se nenhum schedule precisa de preflight, retornar sem chamar Edge Function
  -- ============================================
  IF NOT v_needs_preflight THEN
    RETURN jsonb_build_object(
      'skipped', true,
      'reason', 'No schedules need preflight at this time',
      'checked_at', v_now
    );
  END IF;
  
  -- ============================================
  -- PASSO 3: Existe schedule que precisa → chamar Edge Function
  -- ============================================
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada em system_config');
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada em system_config');
  END IF;

  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/run-preflight',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'called_at', v_now
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'called_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMENT ON FUNCTION call_preflight_edge_function() IS 
  'Verifica em SQL se algum schedule precisa de preflight. Só chama a Edge Function run-preflight via net.http_post quando necessário. Mesmo padrão de check_and_execute_schedules() e run_auto_cancel_check().';


-- ============================================
-- PARTE 2: Atualizar funções de cleanup para incluir cron.job_run_details
-- ============================================

-- 2a. Nova função: limpar registros antigos do pg_cron
CREATE OR REPLACE FUNCTION cleanup_cron_job_run_details()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  -- Remove registros de execução do cron com mais de 3 dias
  -- Com 4 jobs rodando todo minuto = ~5760 registros/dia
  DELETE FROM cron.job_run_details
  WHERE end_time < NOW() - INTERVAL '3 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % registros de cron.job_run_details removidos', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_cron_job_run_details() IS 
  'Remove registros de execução do pg_cron com mais de 3 dias para evitar acúmulo de storage';

-- 2b. Nova função: limpar histórico de cleanup antigo
CREATE OR REPLACE FUNCTION cleanup_old_cleanup_history()
RETURNS TABLE(deleted_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  DELETE FROM cleanup_history
  WHERE executed_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % registros de cleanup_history removidos', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

COMMENT ON FUNCTION cleanup_old_cleanup_history() IS 
  'Remove registros antigos do histórico de limpeza (> 90 dias)';

-- 2c. Atualizar cleanup_old_logs para reter apenas 14 dias (antes era 30)
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS TABLE(deleted_count INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  count_deleted INTEGER;
BEGIN
  -- Reduzido de 30 para 14 dias de retenção
  DELETE FROM execution_logs
  WHERE executed_at < NOW() - INTERVAL '14 days';
  
  GET DIAGNOSTICS count_deleted = ROW_COUNT;
  RAISE NOTICE 'Cleanup: % logs antigos removidos', count_deleted;
  
  RETURN QUERY SELECT count_deleted;
END;
$$;

-- 2d. Atualizar função principal para incluir as novas limpezas
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
BEGIN
  -- Executa todas as limpezas
  SELECT deleted_count INTO logs_count FROM cleanup_old_logs();
  SELECT deleted_count INTO schedules_count FROM cleanup_inactive_schedules();
  SELECT deleted_count INTO reservations_count FROM cleanup_old_reservations();
  
  -- Novas limpezas: cron.job_run_details e cleanup_history
  SELECT deleted_count INTO cron_details_count FROM cleanup_cron_job_run_details();
  SELECT deleted_count INTO cleanup_history_count FROM cleanup_old_cleanup_history();
  
  RAISE NOTICE 'Cleanup extra: % cron details, % cleanup history removidos', 
    cron_details_count, cleanup_history_count;
  
  -- Registra no histórico se a tabela existir
  BEGIN
    INSERT INTO cleanup_history (logs_deleted, schedules_deleted, reservations_deleted)
    VALUES (logs_count, schedules_count, reservations_count);
  EXCEPTION WHEN OTHERS THEN
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

COMMENT ON FUNCTION run_automatic_cleanup() IS 
  'Limpa logs (>14 dias), schedules inativos (>30 dias), reservations (>90 dias), cron.job_run_details (>3 dias) e cleanup_history (>90 dias). Roda diariamente via cron job "automatic-cleanup" às 3h.';


-- ============================================
-- PARTE 3: Aumentar frequência do cleanup de semanal para diário
-- ============================================

DO $$
BEGIN
  PERFORM cron.unschedule('automatic-cleanup');
  RAISE NOTICE '✅ Job automatic-cleanup removido';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Job automatic-cleanup não encontrado: %', SQLERRM;
END $$;

-- Recriar com frequência diária (antes era só domingo)
SELECT cron.schedule(
  'automatic-cleanup',
  '0 3 * * *',   -- Todo dia às 3h da manhã (antes: '0 3 * * 0' = só domingo)
  'SELECT run_automatic_cleanup();'
);


-- ============================================
-- PARTE 4: Limpeza imediata de registros acumulados
-- ============================================

-- Executar limpeza imediata da tabela cron.job_run_details
-- que provavelmente já tem dezenas de milhares de registros acumulados
DELETE FROM cron.job_run_details
WHERE end_time < NOW() - INTERVAL '3 days';


-- ============================================
-- Resumo das mudanças:
-- ============================================
-- 1. call_preflight_edge_function(): reescrita com pré-filtragem em SQL
--    → só invoca a Edge Function quando há schedule que precisa de preflight
--    → cron continua '* * * * *' mas invocações reais caem de ~1440/dia para ~1-5/dia
-- 2. cleanup_old_logs(): retenção 30 dias → 14 dias
-- 3. run_automatic_cleanup(): agora também limpa cron.job_run_details e cleanup_history
-- 4. automatic-cleanup: '0 3 * * 0' → '0 3 * * *' (diário ao invés de semanal)
-- 5. Limpeza imediata de cron.job_run_details acumulados
-- ============================================

-- Para verificar:
-- SELECT jobid, jobname, schedule FROM cron.job ORDER BY jobname;
-- SELECT COUNT(*) FROM cron.job_run_details;
-- SELECT * FROM run_automatic_cleanup();
