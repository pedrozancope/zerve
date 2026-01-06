-- ============================================
-- Auto-Cancel System
-- Cancela reservas do dia automaticamente após uso
-- ============================================

-- 1. Criar tabela de configuração do auto-cancel
CREATE TABLE IF NOT EXISTS auto_cancel_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  enabled BOOLEAN DEFAULT false,
  
  -- Horário de execução do job (hora e minuto)
  run_hour INTEGER NOT NULL DEFAULT 22 CHECK (run_hour >= 0 AND run_hour < 24),
  run_minute INTEGER NOT NULL DEFAULT 0 CHECK (run_minute >= 0 AND run_minute < 60),
  
  -- Motivo do cancelamento
  cancellation_reason TEXT NOT NULL DEFAULT 'Cancelamento automático da reserva',
  
  -- Notificações por e-mail
  notify_on_success_no_reservations BOOLEAN DEFAULT false, -- Sucesso: 0 reservas
  notify_on_success_with_reservations BOOLEAN DEFAULT true, -- Sucesso: 1+ reservas
  notify_on_failure BOOLEAN DEFAULT true, -- Erros
  notification_email TEXT,
  
  -- Controle do job
  pg_cron_job_id BIGINT,
  last_run_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Adicionar campo execution_type para auto-cancel nos logs
-- (se ainda não existir de outras migrations)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'execution_logs_execution_type_check'
    AND conrelid = 'execution_logs'::regclass
  ) THEN
    -- Se a constraint não existe, adicionar a coluna com a constraint
    ALTER TABLE execution_logs
      ADD COLUMN IF NOT EXISTS execution_type VARCHAR(20) DEFAULT 'reservation';
  END IF;
  
  -- Atualizar constraint para incluir 'auto_cancel'
  ALTER TABLE execution_logs
    DROP CONSTRAINT IF EXISTS execution_logs_execution_type_check;
    
  ALTER TABLE execution_logs
    ADD CONSTRAINT execution_logs_execution_type_check
    CHECK (execution_type IN ('reservation', 'preflight', 'test', 'auto_cancel'));
END $$;

-- 3. Criar índices
CREATE INDEX IF NOT EXISTS idx_auto_cancel_config_enabled 
  ON auto_cancel_config(enabled) WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_auto_cancel_config_user 
  ON auto_cancel_config(user_id);

CREATE INDEX IF NOT EXISTS idx_execution_logs_auto_cancel
  ON execution_logs(execution_type, executed_at) 
  WHERE execution_type = 'auto_cancel';

-- 4. Função para criar/atualizar o cron job do auto-cancel
CREATE OR REPLACE FUNCTION manage_auto_cancel_cron_job()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id BIGINT;
  v_supabase_url TEXT;
  v_cron_schedule TEXT;
  v_job_name TEXT;
BEGIN
  -- Obter URL do Supabase
  v_supabase_url := current_setting('supabase.url', true);
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    SELECT value INTO v_supabase_url FROM app_config WHERE key = 'supabase_url';
  END IF;
  
  -- Nome único para o job
  v_job_name := format('auto-cancel-%s', NEW.id);
  
  -- Se estava habilitado anteriormente, remover o job antigo
  IF OLD.pg_cron_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(OLD.pg_cron_job_id);
    RAISE NOTICE 'Auto-cancel cron job % removido', OLD.pg_cron_job_id;
  END IF;
  
  -- Se está habilitado, criar novo job
  IF NEW.enabled THEN
    -- Montar expressão cron: "minuto hora * * *"
    v_cron_schedule := format('%s %s * * *', NEW.run_minute, NEW.run_hour);
    
    -- Criar novo job usando cron.schedule
    SELECT cron.schedule(
      v_job_name,
      v_cron_schedule,
      format(
        'SELECT net.http_post(
          url:=''%s/functions/v1/run-auto-cancel'',
          headers:=''{"Content-Type": "application/json", "Authorization": "Bearer '' || current_setting(''supabase.service_role_key'', true) || ''"}''::jsonb,
          body:=''{}''::jsonb
        )',
        v_supabase_url
      )
    ) INTO v_job_id;
    
    NEW.pg_cron_job_id := v_job_id;
    RAISE NOTICE 'Auto-cancel cron job criado com id % para %', v_job_id, v_cron_schedule;
  ELSE
    NEW.pg_cron_job_id := NULL;
  END IF;
  
  -- Atualizar timestamp
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função para remover o cron job quando a config for deletada
CREATE OR REPLACE FUNCTION remove_auto_cancel_cron_job()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pg_cron_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(OLD.pg_cron_job_id);
    RAISE NOTICE 'Auto-cancel cron job % removido (config deletada)', OLD.pg_cron_job_id;
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Criar triggers
DROP TRIGGER IF EXISTS auto_cancel_config_manage_cron ON auto_cancel_config;
CREATE TRIGGER auto_cancel_config_manage_cron
  BEFORE INSERT OR UPDATE ON auto_cancel_config
  FOR EACH ROW
  EXECUTE FUNCTION manage_auto_cancel_cron_job();

DROP TRIGGER IF EXISTS auto_cancel_config_remove_cron ON auto_cancel_config;
CREATE TRIGGER auto_cancel_config_remove_cron
  BEFORE DELETE ON auto_cancel_config
  FOR EACH ROW
  EXECUTE FUNCTION remove_auto_cancel_cron_job();

-- 7. Comentários para documentação
COMMENT ON TABLE auto_cancel_config IS 
  'Configuração do sistema de cancelamento automático de reservas do dia';

COMMENT ON COLUMN auto_cancel_config.enabled IS 
  'Se o cancelamento automático está habilitado';

COMMENT ON COLUMN auto_cancel_config.run_hour IS 
  'Hora (0-23) em que o job deve executar';

COMMENT ON COLUMN auto_cancel_config.run_minute IS 
  'Minuto (0-59) em que o job deve executar';

COMMENT ON COLUMN auto_cancel_config.cancellation_reason IS 
  'Motivo/justificativa que será enviado na API de cancelamento';

COMMENT ON COLUMN auto_cancel_config.notify_on_success_no_reservations IS 
  'Enviar e-mail quando executar com sucesso mas não encontrar reservas';

COMMENT ON COLUMN auto_cancel_config.notify_on_success_with_reservations IS 
  'Enviar e-mail quando executar com sucesso e cancelar 1+ reservas';

COMMENT ON COLUMN auto_cancel_config.notify_on_failure IS 
  'Enviar e-mail quando houver erro na execução';

COMMENT ON COLUMN auto_cancel_config.pg_cron_job_id IS 
  'ID do job no pg_cron (gerenciado automaticamente)';

COMMENT ON COLUMN auto_cancel_config.last_run_at IS 
  'Data/hora da última execução do job';

-- 8. Criar config padrão para o usuário (se houver algum)
-- Não criamos automaticamente pois o usuário deve habilitar manualmente
