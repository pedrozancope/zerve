-- ============================================
-- Migration 010: Sistema de Cron Corrigido
-- ============================================
-- Esta migration corrige o sistema de agendamento para:
-- 1. Usar pg_cron de forma eficiente
-- 2. Chamar Edge Function apenas quando há schedules para executar
-- 3. Funcionar com trigger_mode = 'trigger_date' (data específica)
-- 4. Funcionar com trigger_mode = 'reservation_date' (recorrente)
-- ============================================

-- Habilitar extensões necessárias (idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ============================================
-- 1. Criar tabela de configuração do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão (você deve atualizar a service_role_key!)
INSERT INTO system_config (key, value, description) VALUES
  ('supabase_url', 'https://ojvbsuprjhvesbwybmqc.supabase.co', 'URL do projeto Supabase'),
  ('service_role_key', 'CONFIGURE_SUA_SERVICE_ROLE_KEY_AQUI', 'Service Role Key do Supabase (Settings > API)')
ON CONFLICT (key) DO NOTHING;

-- Função helper para obter configuração
CREATE OR REPLACE FUNCTION get_system_config(p_key TEXT)
RETURNS TEXT AS $$
  SELECT value FROM system_config WHERE key = p_key;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- 2. Remover jobs antigos duplicados
-- ============================================
DO $$
BEGIN
  -- Remover job antigo se existir
  PERFORM cron.unschedule('check-trigger-date-schedules');
EXCEPTION WHEN OTHERS THEN
  -- Ignorar se não existir
  NULL;
END $$;

-- ============================================
-- 3. Função principal que verifica e executa schedules
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
    RAISE WARNING 'service_role_key não configurada. Execute: UPDATE system_config SET value = ''sua-chave'' WHERE key = ''service_role_key'';';
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
      
      -- Chamar Edge Function via pg_net
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
      
      -- NÃO DESATIVAR AQUI!
      -- A desativação de schedules 'once' é feita pela Edge Function
      -- após execução bem-sucedida, para evitar race condition.
      
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

-- Comentário
COMMENT ON FUNCTION check_and_execute_schedules() IS 
  'Verifica e executa schedules pendentes. Chamada a cada minuto pelo pg_cron.';

-- ============================================
-- 4. Criar job pg_cron que roda a cada minuto
-- ============================================
-- Primeiro, remover job existente se houver
DO $$
BEGIN
  PERFORM cron.unschedule('check-and-execute-schedules');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Criar novo job
SELECT cron.schedule(
  'check-and-execute-schedules',  -- Nome único do job
  '* * * * *',                     -- Roda a cada minuto
  $$SELECT check_and_execute_schedules();$$
);

-- ============================================
-- 5. Função helper para testar manualmente
-- ============================================
CREATE OR REPLACE FUNCTION test_schedule_execution(p_schedule_id UUID)
RETURNS jsonb AS $$
DECLARE
  v_service_key TEXT;
  v_supabase_url TEXT;
  v_request_id BIGINT;
BEGIN
  SELECT value INTO v_supabase_url FROM system_config WHERE key = 'supabase_url';
  SELECT value INTO v_service_key FROM system_config WHERE key = 'service_role_key';
  
  IF v_service_key IS NULL OR v_service_key = 'CONFIGURE_SUA_SERVICE_ROLE_KEY_AQUI' THEN
    RETURN jsonb_build_object('error', 'service_role_key não configurada');
  END IF;
  
  -- Chamar Edge Function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/execute-reservation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object('scheduleId', p_schedule_id::text)
  ) INTO v_request_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'request_id', v_request_id,
    'schedule_id', p_schedule_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION test_schedule_execution(UUID) IS 
  'Função para testar execução de um schedule específico manualmente.';

-- ============================================
-- 5. View para monitorar execuções do pg_cron
-- ============================================
CREATE OR REPLACE VIEW cron_job_status AS
SELECT 
  j.jobid,
  j.jobname,
  j.schedule,
  j.command,
  j.nodename,
  j.nodeport,
  j.database,
  j.username,
  j.active,
  (SELECT MAX(start_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run,
  (SELECT status FROM cron.job_run_details WHERE jobid = j.jobid ORDER BY start_time DESC LIMIT 1) as last_status
FROM cron.job j
WHERE j.jobname LIKE '%schedule%'
ORDER BY j.jobid;

COMMENT ON VIEW cron_job_status IS 'View para monitorar status dos jobs de agendamento';

-- ============================================
-- 6. Limpar jobs antigos/duplicados
-- ============================================
DO $$
DECLARE
  v_job RECORD;
BEGIN
  -- Remover jobs órfãos da tabela schedules
  FOR v_job IN
    SELECT s.id, s.pg_cron_job_id 
    FROM schedules s 
    WHERE s.pg_cron_job_id IS NOT NULL
  LOOP
    BEGIN
      -- Tentar remover job antigo
      PERFORM cron.unschedule(v_job.pg_cron_job_id);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignorar se não existir
    END;
    
    -- Limpar referência
    UPDATE schedules SET pg_cron_job_id = NULL WHERE id = v_job.id;
  END LOOP;
END $$;
