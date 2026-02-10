-- ============================================
-- Reduzir frequência dos cron jobs de preflight e auto-cancel para */10
-- Data: 10/02/2026
-- ============================================
--
-- CONTEXTO: Os 4 cron jobs estão configurados assim:
--   - check-and-execute-schedules: * * * * * (todo minuto) → NÃO ALTERAR (time-sensitive)
--   - preflight-check:             * * * * * (todo minuto) → ALTERAR para */10
--   - auto-cancel-check:           * * * * * (todo minuto) → ALTERAR para */10
--   - automatic-cleanup:           0 3 * * * (diário 3h)  → NÃO ALTERAR (já otimizado)
--
-- ANÁLISE DE SEGURANÇA:
--
-- Todas as 3 funções de verificação usam janela de 10 minutos.
-- Com */10, o cron roda nos minutos 0, 10, 20, 30, 40, 50.
--
-- Cenário de borda: um evento programado para minuto X1 (ex: 11, 21, 31)
-- → próxima verificação no minuto X+10 (20, 30, 40)
-- → 9 minutos dentro da janela de 10 min = OK
--
-- PORÉM: condição é "v_now < trigger + 10min" (exclusivo).
-- Se cron roda no EXATO milissegundo que completa 10 min, pode perder.
--
-- Para preflight: RISCO ZERO. Se perder, o execute-reservation ainda
-- autentica por conta própria. Preflight é apenas pré-validação.
--
-- Para auto-cancel: RISCO MÍNIMO mas real. Para eliminá-lo, ampliamos
-- a janela de 10 para 15 minutos na função run_auto_cancel_check().
-- Com */10, pior caso = 9min59s de atraso, dentro dos 15 min = SEGURO.
--
-- check-and-execute-schedules NÃO é alterado: é a reserva propriamente dita,
-- extremamente time-sensitive. Deve continuar a cada minuto.
-- ============================================


-- ============================================
-- PARTE 1: Alterar cron do preflight-check para */10
-- ============================================

DO $$
BEGIN
  PERFORM cron.unschedule('preflight-check');
  RAISE NOTICE '✅ Job preflight-check removido';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Job preflight-check não encontrado: %', SQLERRM;
END $$;

SELECT cron.schedule(
  'preflight-check',
  '*/10 * * * *',  -- A cada 10 minutos (antes: todo minuto)
  'SELECT call_preflight_edge_function()'
);


-- ============================================
-- PARTE 2: Alterar cron do auto-cancel-check para */10
-- E ampliar janela de detecção de 10 para 15 minutos
-- ============================================

DO $$
BEGIN
  PERFORM cron.unschedule('auto-cancel-check');
  RAISE NOTICE '✅ Job auto-cancel-check removido';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️ Job auto-cancel-check não encontrado: %', SQLERRM;
END $$;

SELECT cron.schedule(
  'auto-cancel-check',
  '*/10 * * * *',  -- A cada 10 minutos (antes: todo minuto)
  'SELECT run_auto_cancel_check()'
);


-- ============================================
-- PARTE 3: Ampliar janela do run_auto_cancel_check() de 10 para 15 minutos
-- Isso elimina o risco de borda com cron */10
-- ============================================

CREATE OR REPLACE FUNCTION run_auto_cancel_check()
RETURNS jsonb AS $$
DECLARE
  v_config RECORD;
  v_request_id BIGINT;
  v_results jsonb := '[]'::jsonb;
  v_service_key TEXT;
  v_supabase_url TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_now_time TIME := v_now::time;
  v_count INT := 0;
  v_run_time TIME;
BEGIN
  -- Obter configurações da tabela system_config
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  IF v_service_key IS NULL OR v_service_key = '' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada em system_config', 'checked_at', v_now);
  END IF;
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RETURN jsonb_build_object('error', 'supabase_url não configurada em system_config', 'checked_at', v_now);
  END IF;

  -- ============================================
  -- Buscar configs habilitadas que devem executar AGORA
  -- - Não executar se já foi executado nos últimos 15 minutos
  -- - Janela de 15 minutos APÓS o horário configurado (ampliada de 10 para 15
  --   para compatibilidade com cron */10, eliminando risco de borda)
  -- ============================================
  FOR v_config IN
    SELECT 
      id,
      user_id,
      run_hour,
      run_minute,
      cancellation_reason,
      last_run_at,
      last_checked_at
    FROM auto_cancel_config
    WHERE enabled = TRUE
      AND (last_run_at IS NULL OR last_run_at < v_now - INTERVAL '15 minutes')
  LOOP
    v_run_time := make_time(v_config.run_hour, v_config.run_minute, 0);
    
    -- Janela ampliada: até 15 minutos após run_time (antes era 10)
    -- Com cron */10, garante que pelo menos 1 execução caia dentro da janela
    IF v_now_time >= v_run_time 
       AND v_now_time < v_run_time + INTERVAL '15 minutes' 
    THEN
      BEGIN
        v_count := v_count + 1;
        
        RAISE NOTICE 'Executando auto-cancel para user: % (Config ID: %) - Horário atual UTC: %, Run time: %:%', 
          v_config.user_id, v_config.id, v_now_time, v_config.run_hour, v_config.run_minute;
        
        -- Marcar como executado ANTES de chamar Edge Function
        UPDATE auto_cancel_config 
        SET last_run_at = v_now,
            last_checked_at = v_now,
            updated_at = v_now
        WHERE id = v_config.id;
        
        -- Chamar Edge Function via pg_net
        SELECT net.http_post(
          url := v_supabase_url || '/functions/v1/run-auto-cancel',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'userId', v_config.user_id::text,
            'dryRun', false,
            'adHoc', false
          ),
          timeout_milliseconds := 60000
        ) INTO v_request_id;
        
        v_results := v_results || jsonb_build_object(
          'config_id', v_config.id,
          'user_id', v_config.user_id,
          'request_id', v_request_id,
          'executed_at', v_now,
          'run_time', format('%s:%s', v_config.run_hour, v_config.run_minute)
        );
        
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Erro ao executar auto-cancel config %: %', v_config.id, SQLERRM;
        v_results := v_results || jsonb_build_object(
          'config_id', v_config.id,
          'user_id', v_config.user_id,
          'error', SQLERRM
        );
      END;
    ELSE
      UPDATE auto_cancel_config 
      SET last_checked_at = v_now
      WHERE id = v_config.id;
    END IF;
  END LOOP;
  
  RETURN jsonb_build_object(
    'checked_at', v_now,
    'current_time_utc', v_now_time,
    'configs_found', v_count,
    'results', v_results
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'error', SQLERRM,
    'checked_at', v_now
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO postgres;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO authenticated;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO service_role;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO anon;

COMMENT ON FUNCTION run_auto_cancel_check() IS 
  'Verifica e executa auto-cancel de reservas. Roda a cada 10 min via pg_cron. Janela de 15 min após horário configurado (UTC). Guard de 15 min contra re-execução.';


-- ============================================
-- PARTE 4: Ampliar janela do preflight na função SQL também (de 10 para 15 min)
-- para mesma garantia de borda
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
      v_trigger_dt := v_schedule.trigger_datetime;
      v_preflight_start := v_trigger_dt - (v_hours_before || ' hours')::INTERVAL;
      -- Janela ampliada de 10 para 15 min (compatível com cron */10)
      v_preflight_end := v_preflight_start + INTERVAL '15 minutes';
      
      IF v_now >= v_preflight_start AND v_now < v_preflight_end THEN
        IF v_schedule.last_preflight_at IS NULL 
           OR v_schedule.last_preflight_at < v_now - INTERVAL '15 minutes' THEN
          v_needs_preflight := TRUE;
          EXIT;
        END IF;
      END IF;
      
    ELSIF v_schedule.trigger_mode = 'reservation_date' THEN
      v_trigger_time_parts := string_to_array(COALESCE(v_schedule.trigger_time::text, '00:01:00'), ':');
      v_trigger_hour := COALESCE(v_trigger_time_parts[1]::INTEGER, 0);
      v_trigger_minute := COALESCE(v_trigger_time_parts[2]::INTEGER, 1);
      
      v_current_dow := EXTRACT(DOW FROM v_now)::INTEGER;
      v_days_until := v_schedule.trigger_day_of_week - v_current_dow;
      IF v_days_until < 0 THEN v_days_until := v_days_until + 7; END IF;
      
      v_next_trigger := date_trunc('day', v_now) + (v_days_until || ' days')::INTERVAL
                        + make_interval(hours := v_trigger_hour, mins := v_trigger_minute);
      
      IF v_days_until = 0 AND v_next_trigger <= v_now THEN
        v_next_trigger := v_next_trigger + INTERVAL '7 days';
      END IF;
      
      v_preflight_start := v_next_trigger - (v_hours_before || ' hours')::INTERVAL;
      -- Janela ampliada de 10 para 15 min (compatível com cron */10)
      v_preflight_end := v_preflight_start + INTERVAL '15 minutes';
      
      IF v_now >= v_preflight_start AND v_now < v_preflight_end THEN
        IF v_schedule.last_preflight_at IS NULL 
           OR v_schedule.last_preflight_at < v_now - INTERVAL '15 minutes' THEN
          v_needs_preflight := TRUE;
          EXIT;
        END IF;
      END IF;
    END IF;
  END LOOP;
  
  -- ============================================
  -- PASSO 2: Se nenhum schedule precisa, retornar sem chamar Edge Function
  -- ============================================
  IF NOT v_needs_preflight THEN
    RETURN jsonb_build_object(
      'skipped', true,
      'reason', 'No schedules need preflight at this time',
      'checked_at', v_now
    );
  END IF;
  
  -- ============================================
  -- PASSO 3: Chamar Edge Function
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
  'Verifica em SQL se algum schedule precisa de preflight (janela 15 min). Só chama Edge Function quando necessário. Compatível com cron */10.';


-- ============================================
-- IMPORTANTE: A janela na Edge Function run-preflight também precisa ser
-- ajustada. Porém a Edge Function tem sua própria lógica com janela de
-- 10 min. Como a função SQL agora filtra com 15 min, e a Edge Function
-- faz sua própria verificação com 10 min, a Edge Function pode rejeitar
-- casos de borda. Isso é OK: a função SQL é o gate principal e a Edge
-- Function é a confirmação final. Se a SQL diz "precisa" e a Edge diz
-- "não precisa mais", nenhum dano é causado (apenas uma invocação extra
-- inofensiva).
-- ============================================


-- ============================================
-- Resumo das mudanças:
-- ============================================
--
-- CRON JOBS (estado final):
-- | Job                          | Antes       | Depois        |
-- |------------------------------|-------------|---------------|
-- | check-and-execute-schedules  | * * * * *   | * * * * *     | ← NÃO ALTERADO (time-sensitive)
-- | preflight-check              | * * * * *   | */10 * * * *  | ← 90% menos execuções
-- | auto-cancel-check            | * * * * *   | */10 * * * *  | ← 90% menos execuções
-- | automatic-cleanup            | 0 3 * * *   | 0 3 * * *     | ← NÃO ALTERADO (já otimizado)
--
-- FUNÇÕES:
-- - call_preflight_edge_function(): janela SQL 10 → 15 min (margem de segurança)
-- - run_auto_cancel_check(): janela 10 → 15 min (margem de segurança)
--
-- IMPACTO EM RECURSOS:
-- - Execuções de cron SQL: de 4×1440=5760/dia para 2×1440 + 2×144 = 3168/dia (-45%)
-- - cron.job_run_details: ~45% menos registros/dia
-- - net._http_response: redução proporcional nas respostas HTTP armazenadas
-- ============================================
