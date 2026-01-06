-- ============================================================================
-- Migration: Add notify_on_zero_reservations toggle
-- ============================================================================
-- Adds a boolean flag to control whether to send email notifications
-- when zero reservations are found during auto-cleanup execution.
-- ============================================================================
ALTER TABLE auto_cleanup_config
ADD COLUMN IF NOT EXISTS notify_on_zero_reservations BOOLEAN DEFAULT true;

COMMENT ON COLUMN auto_cleanup_config.notify_on_zero_reservations IS 'Se true, envia email mesmo quando 0 reservas são encontradas. Se false, só envia quando há reservas canceladas ou erros.';