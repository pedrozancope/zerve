-- Migration: Adicionar opções de configuração de disparo em schedules
-- Executar no SQL Editor do Supabase
-- 1. Adicionar coluna para definir o modo de cálculo da data de disparo
-- 'reservation_date' = calcula baseado em +10 dias da data da reserva (padrão)
-- 'trigger_date' = dispara na data/hora especificada diretamente
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS trigger_mode VARCHAR(20) DEFAULT 'reservation_date' CHECK (
  trigger_mode IN ('reservation_date', 'trigger_date')
);

-- 2. Adicionar coluna para armazenar a data específica de disparo (quando trigger_mode = 'trigger_date')
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS trigger_datetime TIMESTAMP
WITH
  TIME ZONE;

-- 3. Adicionar coluna para o job ID do pg_cron
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS pg_cron_job_id INTEGER;

-- 4. Comentários para documentação
COMMENT ON COLUMN schedules.trigger_mode IS 'Modo de cálculo: reservation_date (+10 dias) ou trigger_date (data específica)';

COMMENT ON COLUMN schedules.trigger_datetime IS 'Data/hora específica para disparo quando trigger_mode = trigger_date';

COMMENT ON COLUMN schedules.pg_cron_job_id IS 'ID do job no pg_cron para gerenciamento';

-- 5. Atualizar registros existentes para usar o modo padrão
UPDATE schedules
SET
  trigger_mode = 'reservation_date'
WHERE
  trigger_mode IS NULL;