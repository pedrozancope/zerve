-- ============================================
-- 017: Fix Pre-flight Reset on Datetime Change
-- ============================================
-- 
-- Problema: Quando o trigger_datetime é alterado, o last_preflight_at não é resetado,
-- fazendo com que o sistema não execute o preflight novamente para o novo horário.
-- 
-- Solução: Criar trigger que reseta last_preflight_at quando trigger_datetime é alterado
-- ============================================

-- 1. Criar função para resetar last_preflight_at quando trigger_datetime mudar
CREATE OR REPLACE FUNCTION trigger_reset_preflight_on_datetime_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o trigger_datetime foi alterado e preflight está habilitado
  IF OLD.trigger_datetime IS DISTINCT FROM NEW.trigger_datetime 
     AND NEW.preflight_enabled = true 
     AND NEW.trigger_datetime IS NOT NULL THEN
    
    -- Resetar last_preflight_at para permitir nova execução do preflight
    NEW.last_preflight_at := NULL;
    
    RAISE NOTICE 'Resetando preflight para schedule % devido a mudança no trigger_datetime de % para %',
      NEW.id, OLD.trigger_datetime, NEW.trigger_datetime;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar trigger para executar a função
DROP TRIGGER IF EXISTS on_schedule_datetime_change ON schedules;
CREATE TRIGGER on_schedule_datetime_change
  BEFORE UPDATE OF trigger_datetime ON schedules
  FOR EACH ROW
  WHEN (OLD.trigger_datetime IS DISTINCT FROM NEW.trigger_datetime)
  EXECUTE FUNCTION trigger_reset_preflight_on_datetime_change();

-- 3. Comentário para documentação
COMMENT ON FUNCTION trigger_reset_preflight_on_datetime_change() IS 
  'Reseta last_preflight_at quando trigger_datetime é alterado, forçando nova execução do preflight';

-- 4. Também resetar preflight quando preflight_hours_before é alterado
CREATE OR REPLACE FUNCTION trigger_reset_preflight_on_config_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Se as configurações de preflight foram alteradas
  IF (OLD.preflight_enabled IS DISTINCT FROM NEW.preflight_enabled 
      OR OLD.preflight_hours_before IS DISTINCT FROM NEW.preflight_hours_before)
     AND NEW.preflight_enabled = true 
     AND NEW.trigger_datetime IS NOT NULL THEN
    
    -- Resetar last_preflight_at para permitir nova execução do preflight
    NEW.last_preflight_at := NULL;
    
    RAISE NOTICE 'Resetando preflight para schedule % devido a mudança nas configurações',
      NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Criar trigger para executar a função
DROP TRIGGER IF EXISTS on_schedule_preflight_config_change ON schedules;
CREATE TRIGGER on_schedule_preflight_config_change
  BEFORE UPDATE OF preflight_enabled, preflight_hours_before ON schedules
  FOR EACH ROW
  WHEN (
    OLD.preflight_enabled IS DISTINCT FROM NEW.preflight_enabled 
    OR OLD.preflight_hours_before IS DISTINCT FROM NEW.preflight_hours_before
  )
  EXECUTE FUNCTION trigger_reset_preflight_on_config_change();

-- 6. Comentário para documentação
COMMENT ON FUNCTION trigger_reset_preflight_on_config_change() IS 
  'Reseta last_preflight_at quando configurações de preflight são alteradas';

