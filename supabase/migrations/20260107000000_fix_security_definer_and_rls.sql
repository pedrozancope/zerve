-- ============================================
-- Fix Supabase Linter Security Issues
-- Data: 07/01/2026
-- ============================================
-- Este script corrige 7 erros de segurança detectados pelo Supabase Linter:
-- 
-- 1. Remove SECURITY DEFINER de 5 views (bypass de RLS)
-- 2. Adiciona RLS em 2 tabelas públicas
--
-- IMPACTO: Baixo risco - apenas aumenta segurança
-- BREAKING CHANGES: Nenhum
-- ============================================

-- ============================================
-- PARTE 1: Remover SECURITY DEFINER de Views
-- ============================================
-- Problema: Views com SECURITY DEFINER executam com permissões do criador,
--           contornando políticas RLS e podendo expor dados indevidos.
-- Solução: Recriar views sem SECURITY DEFINER (padrão SECURITY INVOKER)

-- 1.1 upcoming_reservations
-- Usada no dashboard para listar próximas reservas
DROP VIEW IF EXISTS upcoming_reservations;

CREATE VIEW upcoming_reservations 
WITH (security_invoker = true) AS
SELECT 
  s.id as schedule_id,
  s.name as schedule_name,
  s.user_id,
  s.reservation_day_of_week,
  ts.display_name as time_display,
  ts.external_id,
  s.is_active,
  s.cron_expression
FROM schedules s
JOIN time_slots ts ON s.time_slot_id = ts.id
WHERE s.is_active = true
ORDER BY s.reservation_day_of_week, ts.hour;

COMMENT ON VIEW upcoming_reservations IS 
  'Lista schedules ativos com horários. Usa SECURITY INVOKER para respeitar RLS.';

-- 1.2 public_app_config
-- Expõe apenas configurações não-criptografadas
DROP VIEW IF EXISTS public_app_config;

CREATE VIEW public_app_config 
WITH (security_invoker = true) AS
SELECT 
  id,
  key,
  CASE 
    WHEN is_encrypted THEN NULL
    ELSE value
  END as value,
  is_encrypted,
  updated_at
FROM app_config;

GRANT SELECT ON public_app_config TO authenticated;

COMMENT ON VIEW public_app_config IS 
  'Expõe configurações não-criptografadas. Usa SECURITY INVOKER para respeitar RLS.';

-- 1.3 schedules_needing_preflight
-- Usada pelo sistema de validação prévia
DROP VIEW IF EXISTS schedules_needing_preflight;

CREATE VIEW schedules_needing_preflight 
WITH (security_invoker = true) AS
SELECT 
  s.*,
  ts.hour as time_slot_hour,
  ts.display_name as time_slot_display_name,
  CASE 
    WHEN s.trigger_mode = 'trigger_date' AND s.trigger_datetime IS NOT NULL 
    THEN s.trigger_datetime - (s.preflight_hours_before || ' hours')::INTERVAL
    ELSE NULL
  END as preflight_deadline
FROM schedules s
LEFT JOIN time_slots ts ON s.time_slot_id = ts.id
WHERE s.is_active = true
  AND s.preflight_enabled = true;

COMMENT ON VIEW schedules_needing_preflight IS 
  'Lista schedules que precisam de validação prévia. Usa SECURITY INVOKER para respeitar RLS.';

-- 1.4 cron_job_status
-- Monitoramento de jobs pg_cron
DROP VIEW IF EXISTS cron_job_status;

CREATE VIEW cron_job_status 
WITH (security_invoker = true) AS
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

COMMENT ON VIEW cron_job_status IS 
  'Monitoramento de jobs de agendamento. Usa SECURITY INVOKER para respeitar RLS.';

-- 1.5 user_stats
-- Estatísticas do usuário
DROP VIEW IF EXISTS user_stats;

CREATE VIEW user_stats 
WITH (security_invoker = true) AS
SELECT 
  s.user_id,
  COUNT(DISTINCT s.id) as active_schedules,
  COUNT(el.id) as total_executions,
  COUNT(CASE WHEN el.status = 'success' THEN 1 END) as successful_executions,
  COUNT(CASE WHEN el.status = 'error' THEN 1 END) as failed_executions,
  ROUND(
    CASE 
      WHEN COUNT(el.id) > 0 
      THEN (COUNT(CASE WHEN el.status = 'success' THEN 1 END)::DECIMAL / COUNT(el.id) * 100)
      ELSE 0 
    END, 
    2
  ) as success_rate
FROM schedules s
LEFT JOIN execution_logs el ON s.id = el.schedule_id
WHERE s.is_active = true
GROUP BY s.user_id;

COMMENT ON VIEW user_stats IS 
  'Estatísticas de execução por usuário. Usa SECURITY INVOKER para respeitar RLS.';

-- ============================================
-- PARTE 2: Habilitar RLS em Tabelas Públicas
-- ============================================
-- Problema: Tabelas no schema public sem RLS podem ser acessadas por qualquer usuário autenticado
-- Solução: Habilitar RLS + criar policies apropriadas

-- 2.1 time_slots
-- Tabela de horários disponíveis - dados públicos e fixos
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;

-- Policy: Leitura pública (dados são estáticos e não-sensíveis)
CREATE POLICY "Anyone can view time slots"
  ON time_slots FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy: Apenas service_role pode modificar (evita alterações acidentais)
CREATE POLICY "Only service role can modify time slots"
  ON time_slots FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE time_slots IS 
  'Horários disponíveis para reserva. Dados públicos com RLS habilitado.';

-- 2.2 cleanup_history
-- Histórico de limpezas automáticas - log de sistema
ALTER TABLE cleanup_history ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas service_role pode acessar (dados internos do sistema)
CREATE POLICY "Only service role can access cleanup history"
  ON cleanup_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Usuários autenticados podem apenas ler (transparência do sistema)
CREATE POLICY "Authenticated users can view cleanup history"
  ON cleanup_history FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE cleanup_history IS 
  'Histórico de limpezas automáticas do sistema. RLS habilitado.';

-- ============================================
-- PARTE 3: Verificação Pós-Migration
-- ============================================
-- Query para verificar se RLS está habilitado

DO $$
DECLARE
  rls_status TEXT;
BEGIN
  -- Verificar time_slots
  SELECT CASE WHEN relrowsecurity THEN '✅ HABILITADO' ELSE '❌ DESABILITADO' END
  INTO rls_status
  FROM pg_class
  WHERE relname = 'time_slots' AND relnamespace = 'public'::regnamespace;
  
  RAISE NOTICE 'RLS time_slots: %', rls_status;
  
  -- Verificar cleanup_history
  SELECT CASE WHEN relrowsecurity THEN '✅ HABILITADO' ELSE '❌ DESABILITADO' END
  INTO rls_status
  FROM pg_class
  WHERE relname = 'cleanup_history' AND relnamespace = 'public'::regnamespace;
  
  RAISE NOTICE 'RLS cleanup_history: %', rls_status;
  
  RAISE NOTICE '✅ Migration 20260107000000_fix_security_definer_and_rls.sql concluída com sucesso!';
END $$;
