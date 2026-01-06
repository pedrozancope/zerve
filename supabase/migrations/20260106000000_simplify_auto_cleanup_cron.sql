-- ============================================================================
-- Migration: Simplify Auto-Cleanup Cron Job
-- ============================================================================
-- This migration refactors the auto-cleanup system to follow the same pattern
-- as check_and_execute_schedules() and call_preflight_edge_function().
-- Instead of dynamic cron schedules, we run hourly and check internally.
-- ============================================================================

-- Drop existing triggers first (before dropping functions)
DROP TRIGGER IF EXISTS trigger_update_auto_cleanup_cron ON auto_cleanup_config;
DROP TRIGGER IF EXISTS trigger_remove_auto_cleanup_cron ON auto_cleanup_config;
DROP TRIGGER IF EXISTS auto_cleanup_config_trigger ON auto_cleanup_config;
DROP TRIGGER IF EXISTS auto_cleanup_config_delete_trigger ON auto_cleanup_config;

-- Now drop the functions (CASCADE to handle any remaining dependencies)
DROP FUNCTION IF EXISTS update_auto_cleanup_cron_job() CASCADE;
DROP FUNCTION IF EXISTS remove_auto_cleanup_cron_job() CASCADE;
DROP FUNCTION IF EXISTS run_automatic_cleanup() CASCADE;

-- Remove the old dynamic cron job (if it exists)
DO $$
BEGIN
  -- Find and unschedule any existing auto-cleanup cron jobs
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname LIKE 'auto-cleanup-%';
END $$;

-- ============================================================================
-- Create the new hourly function that checks and executes cleanup
-- ============================================================================
CREATE OR REPLACE FUNCTION run_automatic_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_service_role_key TEXT;
  v_supabase_url TEXT;
  v_current_hour_brt INTEGER;
  v_config_hour INTEGER;
  v_last_run_date DATE;
  v_today_date DATE;
  v_request_id INTEGER;
  v_response JSONB;
BEGIN
  -- Get service role key from app_config
  SELECT value INTO v_service_role_key
  FROM app_config
  WHERE key = 'service_role_key'
  LIMIT 1;

  -- Get Supabase URL from app_config (or use default)
  SELECT value INTO v_supabase_url
  FROM app_config
  WHERE key = 'supabase_url'
  LIMIT 1;

  -- Default to production URL if not configured
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://ojvbsuprjhvesbwybmqc.supabase.co';
  END IF;

  -- Get current hour in BRT (UTC-3)
  v_current_hour_brt := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  v_today_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

  -- Get all enabled auto-cleanup configs
  FOR v_config IN
    SELECT 
      user_id,
      run_time,
      last_run_at,
      notify_on_success,
      notify_on_failure
    FROM auto_cleanup_config
    WHERE enabled = true
  LOOP
    -- Extract hour from configured run_time (format: HH:MM:SS)
    v_config_hour := EXTRACT(HOUR FROM v_config.run_time::TIME);

    -- Get the date of last run (in BRT)
    IF v_config.last_run_at IS NOT NULL THEN
      v_last_run_date := (v_config.last_run_at AT TIME ZONE 'America/Sao_Paulo')::DATE;
    ELSE
      v_last_run_date := NULL;
    END IF;

    -- Check if we should run:
    -- 1. Current hour matches configured hour
    -- 2. Haven't run today yet
    IF v_current_hour_brt = v_config_hour AND 
       (v_last_run_date IS NULL OR v_last_run_date < v_today_date) THEN

      RAISE NOTICE 'Auto-Cleanup: Triggering for user % at hour %', v_config.user_id, v_config_hour;

      -- Call the Edge Function via net.http_post
      BEGIN
        SELECT net.http_post(
          url := v_supabase_url || '/functions/v1/run-post-reservation-cleanup',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'userId', v_config.user_id,
            'dryRun', false,
            'manual', false
          )
        ) INTO v_request_id;

        RAISE NOTICE 'Auto-Cleanup: HTTP request sent for user %, request_id: %', v_config.user_id, v_request_id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Auto-Cleanup: Failed to call Edge Function for user %: %', v_config.user_id, SQLERRM;
      END;

      -- Update last_run_at immediately to prevent double-execution
      UPDATE auto_cleanup_config
      SET last_run_at = NOW()
      WHERE user_id = v_config.user_id;

    END IF;
  END LOOP;

  RETURN;
END;
$$;

-- ============================================================================
-- Schedule the hourly cron job
-- ============================================================================
-- This runs at the top of every hour (0 minutes)
-- The function internally checks if it should execute based on config
DO $$
BEGIN
  -- Unschedule if exists
  PERFORM cron.unschedule('auto-cleanup-hourly-check');
EXCEPTION WHEN OTHERS THEN
  -- Job doesn't exist, that's fine
END $$;

-- Schedule to run every hour at :00 minutes
SELECT cron.schedule(
  'auto-cleanup-hourly-check',
  '0 * * * *', -- Every hour at :00
  'SELECT run_automatic_cleanup();'
);

-- ============================================================================
-- Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO postgres;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO service_role;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON FUNCTION run_automatic_cleanup() IS 
'Checks all enabled auto-cleanup configs and executes cleanup if the current hour (BRT) matches the configured run_time and hasn''t run today yet.';

COMMENT ON TABLE auto_cleanup_config IS 
'Configuration for automatic post-reservation cleanup. The run_time field specifies the hour (in BRT) when cleanup should run daily.';
