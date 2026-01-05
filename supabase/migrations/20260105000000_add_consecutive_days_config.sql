-- Migration: Add consecutive days warning configuration
-- Date: 2026-01-05
-- Description: Adds default configuration for consecutive days warning feature

-- ============================================
-- Insert default configs for consecutive days protection
-- ============================================

-- This feature warns users when creating reservations on consecutive days
-- The configs are stored in app_config table with key/value pairs:
-- - consecutive_days_warning: "true" or "false" (default: true)
-- - min_days_between_reservations: number of minimum days between reservations (default: 1)

-- Note: Configs are created per-user when they access the settings page
-- This migration just documents the feature and ensures the app_config table
-- can handle these new config keys properly

-- Add comment to app_config table documenting the new config keys
COMMENT ON TABLE app_config IS 'User-specific application configuration. Keys include:
- auth_token: Authentication refresh token for Speed system
- notify_on_success: Email notification on successful reservation
- notify_on_failure: Email notification on failed reservation
- notification_email: Email address for notifications
- consecutive_days_warning: Enable/disable warning for consecutive day reservations (default: true)
- min_days_between_reservations: Minimum days required between reservations (default: 1)';

-- Create a function to get default config value
CREATE OR REPLACE FUNCTION get_config_default(config_key TEXT)
RETURNS TEXT AS $$
BEGIN
  CASE config_key
    WHEN 'consecutive_days_warning' THEN RETURN 'true';
    WHEN 'min_days_between_reservations' THEN RETURN '1';
    WHEN 'notify_on_success' THEN RETURN 'true';
    WHEN 'notify_on_failure' THEN RETURN 'true';
    ELSE RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- Done! ✅
-- ============================================
