-- Migration: Adicionar opção 'once' (uma vez) para frequência
-- Executar no SQL Editor do Supabase
-- 1. Remover constraint antiga
ALTER TABLE schedules
DROP CONSTRAINT IF EXISTS schedules_frequency_check;

-- 2. Adicionar nova constraint com 'once'
ALTER TABLE schedules ADD CONSTRAINT schedules_frequency_check CHECK (
  frequency IN ('once', 'weekly', 'biweekly', 'monthly')
);

-- 3. Comentário para documentação
COMMENT ON COLUMN schedules.frequency IS 'Frequência de recorrência: once (uma vez), weekly, biweekly, monthly';