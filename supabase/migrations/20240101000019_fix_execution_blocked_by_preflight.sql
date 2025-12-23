-- ============================================
-- 019: Fix Execution Blocked by Preflight Log
-- ============================================
-- 
-- Problema: Quando o preflight roda, ele cria um log em execution_logs.
-- A função check_and_execute_schedules() verificava logs recentes e
-- PULAVA a execução. Isso bloqueava o agendamento principal após o preflight.
-- 
-- Além disso: Quando alteramos trigger_datetime, precisamos também resetar
-- last_executed_at para permitir nova execução.
-- 
-- Solução: 
-- 1. Remover verificação redundante de logs (já temos last_executed_at)
-- 2. Resetar last_executed_at junto com last_preflight_at ao alterar datetime
-- 3. Simplificar código para facilitar retry futuro
-- ============================================

-- 1. Simplificar função check_and_execute_schedules (sem verificação de logs)
CREATE OR REPLACE FUNCTION check_and_execute_schedules()
RETURNS jsonb AS $$
DECLARE
  v_schedule RECORD;
  v_request_id BIGINT;
  v_results jsonb := '[]'::jsonb;
  v_service_key TEXT;
  v_supabase_url TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_count INT := 0;
BEGIN
  -- Obter configurações da tabela system_config
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  -- Verificar se as configurações existem
  IF v_service_key IS NULL OR v_service_key = '' OR v_service_key = 'CONFIGURE_SUA_SERVICE_ROLE_KEY_AQUI' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada', 'checked_at', v_now);
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada', 'checked_at', v_now);
  END IF;

  -- ============================================
  -- LIMPEZA: Desativar schedules 'once' que já passaram da janela
  -- (trigger_datetime passou há mais de 10 minutos e ainda está ativo)
  -- ============================================
  UPDATE schedules
  SET is_active = FALSE,
      updated_at = v_now
  WHERE is_active = TRUE
    AND frequency = 'once'
    AND trigger_mode = 'trigger_date'
    AND trigger_datetime IS NOT NULL
    AND trigger_datetime < v_now - INTERVAL '10 minutes';

  -- ============================================
  -- Buscar schedules que devem executar AGORA
  -- Usa last_executed_at para evitar duplicatas (simples e eficiente)
  -- ============================================
  FOR v_schedule IN
    SELECT 
      s.id, 
      s.name, 
      s.trigger_mode,
      s.trigger_datetime,
      s.trigger_day_of_week,
      s.trigger_time,
      s.frequency,
      s.last_executed_at
    FROM schedules s
    WHERE s.is_active = TRUE
      -- Não executar se já foi executado nos últimos 10 minutos
      AND (s.last_executed_at IS NULL OR s.last_executed_at < v_now - INTERVAL '10 minutes')
      AND (
        -- Modo 1: trigger_date - executa em data/hora específica
        (
          s.trigger_mode = 'trigger_date'
          AND s.trigger_datetime IS NOT NULL
          AND s.trigger_datetime <= v_now
          AND s.trigger_datetime >= v_now - INTERVAL '5 minutes'
        )
        OR
        -- Modo 2: reservation_date - executa baseado em dia da semana e hora
        (
          s.trigger_mode = 'reservation_date'
          AND EXTRACT(DOW FROM v_now) = s.trigger_day_of_week
          AND s.trigger_time IS NOT NULL
          AND v_now::time >= s.trigger_time
          AND v_now::time < s.trigger_time + INTERVAL '5 minutes'
        )
      )
  LOOP
    BEGIN
      v_count := v_count + 1;
      
      RAISE NOTICE 'Executando schedule: % (ID: %)', v_schedule.name, v_schedule.id;
      
      -- IMPORTANTE: Marcar como executado ANTES de chamar a Edge Function
      -- Isso evita que seja executado novamente no próximo minuto
      UPDATE schedules 
      SET last_executed_at = v_now,
          updated_at = v_now
      WHERE id = v_schedule.id;
      
      -- Chamar Edge Function via pg_net (assíncrono)
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/execute-reservation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object('scheduleId', v_schedule.id::text)
      ) INTO v_request_id;
      
      -- Registrar resultado
      v_results := v_results || jsonb_build_object(
        'schedule_id', v_schedule.id,
        'schedule_name', v_schedule.name,
        'request_id', v_request_id,
        'executed_at', v_now
      );
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Erro ao executar schedule %: %', v_schedule.id, SQLERRM;
      v_results := v_results || jsonb_build_object(
        'schedule_id', v_schedule.id,
        'error', SQLERRM
      );
    END;
  END LOOP;
  
  -- Retornar resumo
  RETURN jsonb_build_object(
    'checked_at', v_now,
    'schedules_found', v_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar trigger para também resetar last_executed_at quando trigger_datetime mudar
CREATE OR REPLACE FUNCTION trigger_reset_preflight_on_datetime_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o trigger_datetime foi alterado
  IF OLD.trigger_datetime IS DISTINCT FROM NEW.trigger_datetime 
     AND NEW.trigger_datetime IS NOT NULL THEN
    
    -- Sempre resetar last_executed_at quando a data/hora de disparo muda
    -- Isso permite que o agendamento execute no novo horário
    NEW.last_executed_at := NULL;
    
    -- Se preflight está habilitado, resetar também last_preflight_at
    IF NEW.preflight_enabled = true THEN
      NEW.last_preflight_at := NULL;
    END IF;
    
    RAISE NOTICE 'Resetando execução para schedule % devido a mudança no trigger_datetime de % para %',
      NEW.id, OLD.trigger_datetime, NEW.trigger_datetime;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Recriar o trigger
DROP TRIGGER IF EXISTS on_schedule_datetime_change ON schedules;
CREATE TRIGGER on_schedule_datetime_change
  BEFORE UPDATE OF trigger_datetime ON schedules
  FOR EACH ROW
  WHEN (OLD.trigger_datetime IS DISTINCT FROM NEW.trigger_datetime)
  EXECUTE FUNCTION trigger_reset_preflight_on_datetime_change();

-- 4. Comentários
COMMENT ON FUNCTION check_and_execute_schedules() IS 
  'Verifica e executa schedules pendentes. Usa apenas last_executed_at para evitar duplicatas.';

COMMENT ON FUNCTION trigger_reset_preflight_on_datetime_change() IS 
  'Reseta last_executed_at e last_preflight_at quando trigger_datetime é alterado';
