-- ============================================
-- Auto Post-Reservation Cleanup System
-- Cancela automaticamente reservas após utilização
-- para liberar agendamentos em dias consecutivos
-- ============================================

-- 1. Tabela de configuração do Auto-Cleanup
CREATE TABLE IF NOT EXISTS auto_cleanup_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  -- Horário de execução (em BRT, convertido para UTC no cron)
  run_time TIME DEFAULT '22:00:00',
  -- Motivo padrão para cancelamento
  cancellation_reason TEXT DEFAULT 'Cancelamento automático pós-utilização - Zerve',
  -- Notificações
  notify_on_success BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  -- Controle
  last_run_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Garantir apenas uma config por usuário
  UNIQUE(user_id)
);

-- 2. Tabela de histórico de execuções do cleanup
CREATE TABLE IF NOT EXISTS auto_cleanup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Estatísticas
  reservations_found INTEGER DEFAULT 0,
  reservations_cancelled INTEGER DEFAULT 0,
  reservations_failed INTEGER DEFAULT 0,
  -- Detalhes das reservas processadas
  details JSONB DEFAULT '[]'::jsonb,
  -- Status: success (todas canceladas), partial (algumas falharam), error (erro geral), no_reservations (nada para cancelar)
  status VARCHAR(20) CHECK (status IN ('success', 'partial', 'error', 'no_reservations')),
  error_message TEXT,
  -- Modo de execução
  is_dry_run BOOLEAN DEFAULT false,
  is_manual BOOLEAN DEFAULT false,
  -- Timing
  duration_ms INTEGER,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_auto_cleanup_config_user ON auto_cleanup_config(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_cleanup_config_enabled ON auto_cleanup_config(enabled);
CREATE INDEX IF NOT EXISTS idx_auto_cleanup_history_user ON auto_cleanup_history(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_cleanup_history_date ON auto_cleanup_history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_cleanup_history_status ON auto_cleanup_history(status);

-- 4. Row Level Security (RLS)
ALTER TABLE auto_cleanup_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_cleanup_history ENABLE ROW LEVEL SECURITY;

-- Policies para auto_cleanup_config
CREATE POLICY "Users can view their own cleanup config"
  ON auto_cleanup_config FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cleanup config"
  ON auto_cleanup_config FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cleanup config"
  ON auto_cleanup_config FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cleanup config"
  ON auto_cleanup_config FOR DELETE
  USING (auth.uid() = user_id);

-- Policies para auto_cleanup_history
CREATE POLICY "Users can view their own cleanup history"
  ON auto_cleanup_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cleanup history"
  ON auto_cleanup_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role pode inserir sem restrição (para Edge Functions)
CREATE POLICY "Service role can manage cleanup config"
  ON auto_cleanup_config FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can manage cleanup history"
  ON auto_cleanup_history FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 5. Função para obter hora UTC a partir de BRT
-- Ex: 22:00 BRT = 01:00 UTC (do dia seguinte)
CREATE OR REPLACE FUNCTION get_utc_hour_from_brt(brt_time TIME)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  brt_hour INTEGER;
  utc_hour INTEGER;
BEGIN
  brt_hour := EXTRACT(HOUR FROM brt_time);
  -- BRT = UTC - 3, então UTC = BRT + 3
  utc_hour := (brt_hour + 3) % 24;
  RETURN utc_hour;
END;
$$;

-- 6. Função para criar/atualizar o cron job do cleanup
CREATE OR REPLACE FUNCTION update_auto_cleanup_cron_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name TEXT;
  utc_hour INTEGER;
  cron_expression TEXT;
  function_url TEXT;
  service_role_key TEXT;
BEGIN
  job_name := 'auto-cleanup-' || NEW.user_id::TEXT;
  
  -- Remove job existente se houver
  PERFORM cron.unschedule(job_name);
  
  -- Se desabilitado, apenas remove o job
  IF NOT NEW.enabled THEN
    RETURN NEW;
  END IF;
  
  -- Calcular hora UTC a partir do horário BRT configurado
  utc_hour := get_utc_hour_from_brt(NEW.run_time);
  
  -- Cron expression: minuto 0 da hora UTC, todos os dias
  cron_expression := '0 ' || utc_hour || ' * * *';
  
  -- Obter URL da função e service role key
  function_url := current_setting('app.supabase_url', true) || '/functions/v1/run-post-reservation-cleanup';
  service_role_key := current_setting('app.service_role_key', true);
  
  -- Agendar o job usando pg_net para chamar a Edge Function
  PERFORM cron.schedule(
    job_name,
    cron_expression,
    format(
      'SELECT net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''Authorization'', ''Bearer '' || %L), body := jsonb_build_object(''userId'', %L))',
      function_url,
      service_role_key,
      NEW.user_id::TEXT
    )
  );
  
  RAISE NOTICE 'Auto-cleanup cron job % scheduled at % UTC (% BRT)', job_name, utc_hour, EXTRACT(HOUR FROM NEW.run_time);
  
  RETURN NEW;
END;
$$;

-- 7. Trigger para atualizar cron job quando config muda
DROP TRIGGER IF EXISTS trigger_update_auto_cleanup_cron ON auto_cleanup_config;
CREATE TRIGGER trigger_update_auto_cleanup_cron
  AFTER INSERT OR UPDATE OF enabled, run_time ON auto_cleanup_config
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_cleanup_cron_job();

-- 8. Trigger para remover cron job quando config é deletada
CREATE OR REPLACE FUNCTION remove_auto_cleanup_cron_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  job_name TEXT;
BEGIN
  job_name := 'auto-cleanup-' || OLD.user_id::TEXT;
  PERFORM cron.unschedule(job_name);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trigger_remove_auto_cleanup_cron ON auto_cleanup_config;
CREATE TRIGGER trigger_remove_auto_cleanup_cron
  BEFORE DELETE ON auto_cleanup_config
  FOR EACH ROW
  EXECUTE FUNCTION remove_auto_cleanup_cron_job();

-- 9. Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_auto_cleanup_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_cleanup_config_updated_at ON auto_cleanup_config;
CREATE TRIGGER trigger_auto_cleanup_config_updated_at
  BEFORE UPDATE ON auto_cleanup_config
  FOR EACH ROW
  EXECUTE FUNCTION update_auto_cleanup_config_updated_at();

-- ============================================
-- Comentários e Documentação
-- ============================================

COMMENT ON TABLE auto_cleanup_config IS 'Configurações do sistema de cancelamento automático de reservas pós-utilização';
COMMENT ON TABLE auto_cleanup_history IS 'Histórico das execuções do auto-cleanup';
COMMENT ON COLUMN auto_cleanup_config.run_time IS 'Horário de execução em BRT (será convertido para UTC no cron)';
COMMENT ON COLUMN auto_cleanup_config.cancellation_reason IS 'Motivo enviado à API ao cancelar reservas';
COMMENT ON COLUMN auto_cleanup_history.details IS 'Array JSON com detalhes de cada reserva processada';
COMMENT ON COLUMN auto_cleanup_history.is_dry_run IS 'Se true, foi uma simulação sem cancelamento real';
COMMENT ON COLUMN auto_cleanup_history.is_manual IS 'Se true, foi executado manualmente pelo usuário';

-- ============================================
-- Para testar manualmente:
-- ============================================
-- SELECT * FROM auto_cleanup_config;
-- SELECT * FROM auto_cleanup_history ORDER BY executed_at DESC LIMIT 10;
-- SELECT * FROM cron.job WHERE jobname LIKE 'auto-cleanup-%';
