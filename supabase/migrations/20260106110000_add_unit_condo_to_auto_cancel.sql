-- ============================================
-- Add unit_id and condo_id to auto_cancel_config
-- ============================================
-- Move valores hardcoded para configurações flexíveis

ALTER TABLE auto_cancel_config
ADD COLUMN unit_id TEXT DEFAULT '17686',
ADD COLUMN condo_id TEXT DEFAULT '185';

-- Adicionar comentário explicativo
COMMENT ON COLUMN auto_cancel_config.unit_id IS 'ID da unidade no sistema SuperLógica (ex: 17686)';
COMMENT ON COLUMN auto_cancel_config.condo_id IS 'ID do condomínio no sistema SuperLógica (ex: 185)';

-- Atualizar registros existentes com valores padrão
UPDATE auto_cancel_config 
SET unit_id = '17686', condo_id = '185'
WHERE unit_id IS NULL OR condo_id IS NULL;

DO $$
BEGIN
  RAISE NOTICE '✅ Colunas unit_id e condo_id adicionadas à auto_cancel_config';
  RAISE NOTICE 'ℹ️  Valores padrão: unit_id=17686, condo_id=185';
END $$;
