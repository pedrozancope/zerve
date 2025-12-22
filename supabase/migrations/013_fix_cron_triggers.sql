-- ============================================
-- Migration 013: Corrigir triggers e funções de pg_cron
-- ============================================
-- 
-- Problema: Triggers falham quando tentam deletar jobs que não existem
-- Solução: Adicionar tratamento de erro com EXCEPTION
-- ============================================

-- 0. REMOVER função/trigger antigo que pode estar causando conflito
DROP FUNCTION IF EXISTS manage_schedule_cron_job() CASCADE;
DROP TRIGGER IF EXISTS manage_schedule_cron_trigger ON schedules;

-- 1. Corrigir função de deletar job (com tratamento de erro)
CREATE OR REPLACE FUNCTION delete_schedule_cron_job(p_job_id BIGINT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_job_id IS NOT NULL THEN
    -- Verificar se o job existe antes de tentar deletar
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobid = p_job_id) THEN
      PERFORM cron.unschedule(p_job_id);
      RETURN true;
    ELSE
      RAISE NOTICE 'Job % não encontrado, já foi deletado', p_job_id;
      RETURN false;
    END IF;
  END IF;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  -- Se falhar por qualquer motivo, apenas logar e continuar
  RAISE NOTICE 'Erro ao deletar job %: %', p_job_id, SQLERRM;
  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION delete_schedule_cron_job(BIGINT) IS 
  'Deleta um job do pg_cron com tratamento de erro. Retorna false se o job não existir.';

-- 2. Corrigir trigger de delete (com tratamento de erro)
CREATE OR REPLACE FUNCTION trigger_delete_schedule_cron_job()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.pg_cron_job_id IS NOT NULL THEN
    -- Tentar deletar o job, mas não falhar se não existir
    BEGIN
      PERFORM delete_schedule_cron_job(OLD.pg_cron_job_id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao deletar job % no trigger: %', OLD.pg_cron_job_id, SQLERRM;
    END;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trigger_delete_schedule_cron_job() IS 
  'Trigger que deleta job do pg_cron quando schedule é deletado.';

-- Recriar o trigger
DROP TRIGGER IF EXISTS on_schedule_delete ON schedules;
CREATE TRIGGER on_schedule_delete
  BEFORE DELETE ON schedules
  FOR EACH ROW
  EXECUTE FUNCTION trigger_delete_schedule_cron_job();

-- 3. Limpar referências órfãs existentes
-- (schedules que apontam para jobs que não existem mais)
UPDATE schedules
SET pg_cron_job_id = NULL
WHERE pg_cron_job_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobid = schedules.pg_cron_job_id
  );

-- 4. Ver quantos registros foram limpos
DO $$
DECLARE
  v_cleaned INT;
BEGIN
  SELECT COUNT(*) INTO v_cleaned
  FROM schedules
  WHERE pg_cron_job_id IS NULL 
    AND updated_at > NOW() - INTERVAL '1 minute';
  
  IF v_cleaned > 0 THEN
    RAISE NOTICE 'Limpou % referências órfãs de pg_cron_job_id', v_cleaned;
  END IF;
END $$;
