-- ============================================
-- Recriar função com padrão UTC correto
-- ============================================

DROP FUNCTION IF EXISTS run_auto_cancel_check();

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
  v_today_brt DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_count INT := 0;
  v_run_time TIME;
  v_last_run_brt_date DATE;
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
  -- Buscar configs habilitadas que devem executar AGORA
  -- REGRA: Executa na janela de 10min APÓS o horário configurado (UTC)
  -- Não executar se já foi executado nos últimos 15 minutos (igual schedules)
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
      -- Não executar se já foi executado nos últimos 15 minutos (padrão schedules)
      AND (last_run_at IS NULL OR last_run_at < v_now - INTERVAL '15 minutes')
  LOOP
    -- Construir horário configurado (em UTC)
    v_run_time := make_time(v_config.run_hour, v_config.run_minute, 0);
    
    -- Verificar se está na janela de tempo correta (até 10min após run_time)
    -- NUNCA antes, até 10 minutos depois (padrão de check_and_execute_schedules)
    IF v_now_time >= v_run_time 
       AND v_now_time < v_run_time + INTERVAL '10 minutes' 
    THEN
      -- Verificar se já executou HOJE (em BRT)
      -- Se last_run_at é NULL ou é de um dia diferente de hoje, pode executar
      IF v_config.last_run_at IS NULL THEN
        v_last_run_brt_date := NULL;
      ELSE
        v_last_run_brt_date := (v_config.last_run_at AT TIME ZONE 'America/Sao_Paulo')::date;
      END IF;
      
      -- Se já executou hoje (em BRT), pular
      IF v_last_run_brt_date = v_today_brt THEN
        RAISE NOTICE 'Config % já executou hoje (BRT): last_run=%, today=%', 
          v_config.id, v_last_run_brt_date, v_today_brt;
        
        -- Apenas atualizar last_checked_at
        UPDATE auto_cancel_config 
        SET last_checked_at = v_now
        WHERE id = v_config.id;
        
        CONTINUE;
      END IF;
      BEGIN
        v_count := v_count + 1;
        
        RAISE NOTICE 'Executando auto-cancel para user: % (Config ID: %) - Horário atual UTC: %, Run time: %:%', 
          v_config.user_id, v_config.id, v_now_time, v_config.run_hour, v_config.run_minute;
        
        -- IMPORTANTE: Marcar como executado ANTES de chamar a Edge Function
        -- Isso evita que seja executado novamente no próximo minuto
        UPDATE auto_cancel_config 
        SET last_run_at = v_now,
            last_checked_at = v_now,
            updated_at = v_now
        WHERE id = v_config.id;
        
        -- Chamar Edge Function via pg_net (assíncrono) - PADRÃO IDÊNTICO aos outros
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
        
        -- Registrar resultado
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
      -- Apenas atualizar last_checked_at
      UPDATE auto_cancel_config 
      SET last_checked_at = v_now
      WHERE id = v_config.id;
    END IF;
  END LOOP;
  
  -- Retornar resumo (formato IDÊNTICO aos outros sistemas)
  RETURN jsonb_build_object(
    'checked_at', v_now,
    'current_time_utc', v_now_time,
    'configs_found', v_count,
    'results', v_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO postgres;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO authenticated;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO service_role;
GRANT EXECUTE ON FUNCTION run_auto_cancel_check() TO anon;

-- Atualizar comentários
COMMENT ON FUNCTION run_auto_cancel_check() IS 
  'Verifica e executa auto-cancel de reservas. Roda todo minuto via pg_cron. Executa na janela de 10min após o horário configurado (UTC). Padrão replicado de check_and_execute_schedules().';

COMMENT ON COLUMN auto_cancel_config.run_hour IS 
  'Hora (0-23) em UTC (não BRT) em que o cancelamento deve executar. Frontend converte BRT→UTC (+3h). Padrão igual aos schedules.';

COMMENT ON COLUMN auto_cancel_config.run_minute IS 
  'Minuto (0-59) em que o cancelamento deve executar';

