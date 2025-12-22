-- ============================================
-- Migration 011: Corrigir Race Condition
-- ============================================
-- O problema: A função SQL desativa o schedule ANTES da Edge Function
-- conseguir processá-lo (pg_net é assíncrono).
-- 
-- Solução: NÃO desativar aqui. A Edge Function será responsável por
-- desativar schedules com frequency='once' após execução bem-sucedida.
-- ============================================

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
    RAISE WARNING 'service_role_key não configurada.';
    RETURN jsonb_build_object('error', 'service_role_key não configurada', 'checked_at', v_now);
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE WARNING 'supabase_url não configurada.';
    RETURN jsonb_build_object('error', 'supabase_url não configurada', 'checked_at', v_now);
  END IF;

  -- ============================================
  -- Buscar schedules que devem executar AGORA
  -- ============================================
  FOR v_schedule IN
    SELECT 
      s.id, 
      s.name, 
      s.trigger_mode,
      s.trigger_datetime,
      s.trigger_day_of_week,
      s.trigger_time,
      s.frequency
    FROM schedules s
    WHERE s.is_active = TRUE
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
      
      -- Chamar Edge Function via pg_net (assíncrono)
      -- A Edge Function será responsável por desativar schedules 'once'
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/execute-reservation',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key
        ),
        body := jsonb_build_object(
          'scheduleId', v_schedule.id::text,
          'frequency', v_schedule.frequency  -- Passar frequência para a Edge Function
        )
      ) INTO v_request_id;
      
      -- Registrar resultado
      v_results := v_results || jsonb_build_object(
        'schedule_id', v_schedule.id,
        'schedule_name', v_schedule.name,
        'frequency', v_schedule.frequency,
        'request_id', v_request_id,
        'executed_at', v_now
      );
      
      -- NÃO DESATIVAR AQUI!
      -- A desativação será feita pela Edge Function após execução bem-sucedida.
      -- Isso evita race condition onde o schedule é desativado antes da Edge Function processá-lo.
      
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

COMMENT ON FUNCTION check_and_execute_schedules() IS 
  'Verifica e executa schedules pendentes. Chamada a cada minuto pelo pg_cron. NÃO desativa schedules - isso é responsabilidade da Edge Function.';
