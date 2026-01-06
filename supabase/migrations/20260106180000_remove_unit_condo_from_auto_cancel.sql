-- Migration: Remove redundant unit_id and condo_id from auto_cancel_config
-- Description: These values are already stored in app_config table and managed through /settings
-- Date: 2026-01-06
-- Remove unit_id and condo_id columns from auto_cancel_config
-- These are redundant since they're stored globally in app_config
ALTER TABLE auto_cancel_config
DROP COLUMN IF EXISTS unit_id,
DROP COLUMN IF EXISTS condo_id;

-- Note: unit_id and condo_id should be fetched from app_config when needed
-- Example query to get them:
-- SELECT value FROM app_config WHERE key = 'unit_id' AND user_id IS NULL;
-- SELECT value FROM app_config WHERE key = 'condo_id' AND user_id IS NULL;