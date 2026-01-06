1 -- Migration: Fix RLS Security Gaps
-- Created: 2026-01-06
-- Description: Enable RLS on auto_cancel_config and system_config to prevent unauthorized access
-- 
-- Issues fixed:
-- 1. auto_cancel_config has NO RLS policies (any authenticated user can read/modify others' configs)
-- 2. system_config may expose service_role_key if not properly protected
-- ============================================
-- FIX #1: Enable RLS on auto_cancel_config
-- ============================================
-- Enable Row Level Security
ALTER TABLE auto_cancel_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (idempotent)
DROP POLICY IF EXISTS "Users can view their own auto_cancel_config" ON auto_cancel_config;

DROP POLICY IF EXISTS "Users can insert their own auto_cancel_config" ON auto_cancel_config;

DROP POLICY IF EXISTS "Users can update their own auto_cancel_config" ON auto_cancel_config;

DROP POLICY IF EXISTS "Users can delete their own auto_cancel_config" ON auto_cancel_config;

-- Create policies for auto_cancel_config (same pattern as schedules table)
CREATE POLICY "Users can view their own auto_cancel_config" ON auto_cancel_config FOR
SELECT
  USING (auth.uid () = user_id);

CREATE POLICY "Users can insert their own auto_cancel_config" ON auto_cancel_config FOR INSERT
WITH
  CHECK (auth.uid () = user_id);

CREATE POLICY "Users can update their own auto_cancel_config" ON auto_cancel_config FOR
UPDATE USING (auth.uid () = user_id);

CREATE POLICY "Users can delete their own auto_cancel_config" ON auto_cancel_config FOR DELETE USING (auth.uid () = user_id);

-- ============================================
-- FIX #2: Protect system_config from direct access
-- ============================================
-- Enable Row Level Security
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any (idempotent)
DROP POLICY IF EXISTS "No direct user access to system_config" ON system_config;

-- Block ALL direct access from regular users
-- Only SECURITY DEFINER functions can access (they bypass RLS)
CREATE POLICY "No direct user access to system_config" ON system_config FOR ALL USING (false);

-- ============================================
-- Validation queries (run manually to verify)
-- ============================================
-- Verify RLS is enabled:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('auto_cancel_config', 'system_config');
-- Expected: both should have relrowsecurity = true
-- Verify policies exist:
-- SELECT tablename, policyname, cmd FROM pg_policies WHERE tablename IN ('auto_cancel_config', 'system_config');
-- Expected: 4 policies for auto_cancel_config, 1 for system_config
-- Test that SQL functions can still access system_config:
-- SELECT check_and_execute_schedules();
-- Expected: should work normally (functions bypass RLS)
-- Test that users CANNOT access system_config directly:
-- SELECT * FROM system_config;
-- Expected: returns 0 rows (blocked by policy)