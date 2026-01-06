-- ============================================
-- Refatoração: Padronização da tabela auto_cancel_config
-- Objetivo: Alinhar estrutura com tabela schedules para melhor manutenção
-- ============================================

-- Passo 1: Adicionar novos campos
ALTER TABLE auto_cancel_config
  ADD COLUMN IF NOT EXISTS trigger_time TIME DEFAULT '22:00';

-- Passo 2: Migrar dados de run_hour/run_minute para trigger_time
UPDATE auto_cancel_config
  SET trigger_time = MAKE_INTERVAL(hours => run_hour, mins => run_minute)::TIME
  WHERE run_hour IS NOT NULL AND run_minute IS NOT NULL;

-- Passo 3: Renomear enabled para is_active
ALTER TABLE auto_cancel_config
  RENAME COLUMN enabled TO is_active;

-- Passo 4: Renomear last_run_at para last_executed_at
ALTER TABLE auto_cancel_config
  RENAME COLUMN last_run_at TO last_executed_at;

-- Passo 5: Mover notification_email de coluna para app_config
-- Migrar dados existentes (se houver)
DO $$
DECLARE
  v_config RECORD;
BEGIN
  -- Para cada configuração com notification_email
  FOR v_config IN 
    SELECT id, user_id, notification_email 
    FROM auto_cancel_config 
    WHERE notification_email IS NOT NULL 
      AND notification_email != ''
  LOOP
    -- Verificar se já existe entrada em app_config
    IF NOT EXISTS (
      SELECT 1 FROM app_config 
      WHERE user_id = v_config.user_id 
      AND key = 'notification_email'
    ) THEN
      -- Inserir em app_config
      INSERT INTO app_config (user_id, key, value, updated_at)
      VALUES (v_config.user_id, 'notification_email', v_config.notification_email, NOW())
      ON CONFLICT (user_id, key) DO UPDATE 
        SET value = EXCLUDED.value, updated_at = NOW();
    END IF;
  END LOOP;
END $$;

-- Passo 6: Remover coluna notification_email de auto_cancel_config
ALTER TABLE auto_cancel_config
  DROP COLUMN IF EXISTS notification_email;

-- Passo 7: Remover coluna last_checked_at (redundante com last_executed_at)
ALTER TABLE auto_cancel_config
  DROP COLUMN IF EXISTS last_checked_at;

-- Passo 8: Remover colunas run_hour e run_minute (agora em trigger_time)
ALTER TABLE auto_cancel_config
  DROP COLUMN IF EXISTS run_hour,
  DROP COLUMN IF EXISTS run_minute;

-- Passo 9: Adicionar constraint de validação em is_active
ALTER TABLE auto_cancel_config
  ADD CONSTRAINT auto_cancel_config_is_active_check 
  CHECK (is_active IN (true, false));

-- Passo 10: Atualizar índices existentes
DROP INDEX IF EXISTS idx_auto_cancel_config_enabled;

CREATE INDEX IF NOT EXISTS idx_auto_cancel_config_is_active 
  ON auto_cancel_config(is_active) WHERE is_active = true;

-- Índice por user_id para queries frequentes
CREATE INDEX IF NOT EXISTS idx_auto_cancel_config_user_id 
  ON auto_cancel_config(user_id);

-- Índice composto para queries de usuário ativo
CREATE INDEX IF NOT EXISTS idx_auto_cancel_config_user_active 
  ON auto_cancel_config(user_id, is_active) WHERE is_active = true;

-- Passo 11: Atualizar comentários de tabela/colunas
COMMENT ON TABLE auto_cancel_config IS 
'Configuração do sistema de cancelamento automático de reservas. Alinhada com padrão de schedules.';

COMMENT ON COLUMN auto_cancel_config.is_active IS 
'Status do auto-cancel (ativo/inativo)';

COMMENT ON COLUMN auto_cancel_config.trigger_time IS 
'Hora de execução do job (HH:MM:SS), padrão 22:00';

COMMENT ON COLUMN auto_cancel_config.cancellation_reason IS 
'Motivo exibido ao cancelar reserva';

COMMENT ON COLUMN auto_cancel_config.notify_on_success_no_reservations IS 
'Enviar notificação quando sucesso mas 0 reservas encontradas';

COMMENT ON COLUMN auto_cancel_config.notify_on_success_with_reservations IS 
'Enviar notificação quando sucesso e 1+ reservas canceladas';

COMMENT ON COLUMN auto_cancel_config.notify_on_failure IS 
'Enviar notificação quando erro na execução';

COMMENT ON COLUMN auto_cancel_config.last_executed_at IS 
'Timestamp da última execução do auto-cancel';

COMMENT ON COLUMN auto_cancel_config.unit_id IS 
'ID da unidade no sistema SuperLógica (ex: 17686)';

COMMENT ON COLUMN auto_cancel_config.condo_id IS 
'ID do condomínio no sistema SuperLógica (ex: 185)';

-- Passo 12: Atualizar a função que gerencia o cron job
-- Função precisa ser recriada pois as colunas mudaram
CREATE OR REPLACE FUNCTION manage_auto_cancel_cron_job()
RETURNS TRIGGER AS $$
DECLARE
  v_job_id BIGINT;
  v_supabase_url TEXT;
  v_cron_schedule TEXT;
  v_job_name TEXT;
  v_hour INTEGER;
  v_minute INTEGER;
BEGIN
  -- Extrair hora e minuto de trigger_time
  v_hour := EXTRACT(HOUR FROM NEW.trigger_time)::INTEGER;
  v_minute := EXTRACT(MINUTE FROM NEW.trigger_time)::INTEGER;
  
  -- Obter URL do Supabase
  v_supabase_url := current_setting('supabase.url', true);
  
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    SELECT value INTO v_supabase_url FROM app_config WHERE key = 'supabase_url';
  END IF;
  
  -- Nome único para o job
  v_job_name := format('auto-cancel-%s', NEW.id);
  
  -- Se estava ativo anteriormente, remover o job antigo
  IF OLD IS NOT NULL AND OLD.pg_cron_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(OLD.pg_cron_job_id);
    RAISE NOTICE 'Auto-cancel cron job % removido', OLD.pg_cron_job_id;
  END IF;
  
  -- Se está ativo, criar novo job
  IF NEW.is_active THEN
    -- Montar expressão cron: "minuto hora * * *"
    v_cron_schedule := format('%s %s * * *', v_minute, v_hour);
    
    -- Criar novo job usando cron.schedule
    SELECT cron.schedule(
      v_job_name,
      v_cron_schedule,
      format(
        'SELECT http_post(''%s/functions/v1/run-auto-cancel'', json_build_object(''configId'', ''%s''), ''application/json'')',
        v_supabase_url,
        NEW.id
      )
    ) INTO v_job_id;
    
    -- Atualizar o ID do job na tabela
    NEW.pg_cron_job_id := v_job_id;
    
    RAISE NOTICE 'Auto-cancel cron job % criado com expressão: %', v_job_id, v_cron_schedule;
  ELSIF NEW.pg_cron_job_id IS NOT NULL THEN
    -- Se desabilitado mas tinha job, garantir que está removido
    PERFORM cron.unschedule(NEW.pg_cron_job_id);
    NEW.pg_cron_job_id := NULL;
    RAISE NOTICE 'Auto-cancel cron job removido (desabilitado)';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE PLPGSQL;

-- Passo 13: Recriar triggers com novos nomes de colunas
DROP TRIGGER IF EXISTS auto_cancel_config_manage_cron ON auto_cancel_config;
CREATE TRIGGER auto_cancel_config_manage_cron
  BEFORE INSERT OR UPDATE ON auto_cancel_config
  FOR EACH ROW
  EXECUTE FUNCTION manage_auto_cancel_cron_job();

-- Nota: O trigger auto_cancel_config_remove_cron usa a função manage_auto_cancel_delete_cron_job()
-- que já existe nas migrations anteriores (20260106010000 ou 20260106020000)
DROP TRIGGER IF EXISTS auto_cancel_config_remove_cron ON auto_cancel_config;
CREATE TRIGGER auto_cancel_config_remove_cron
  BEFORE DELETE ON auto_cancel_config
  FOR EACH ROW
  WHEN (OLD.pg_cron_job_id IS NOT NULL)
  EXECUTE FUNCTION manage_auto_cancel_delete_cron_job();
