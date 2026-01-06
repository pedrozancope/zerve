-- ============================================================================
-- Migration: Fix Auto-Cleanup Cron Function
-- ============================================================================
-- Issues fixed:
-- 1. Use hardcoded anon key instead of looking in app_config
-- 2. Better timestamp handling (now() in UTC)
-- 3. Better error handling and logging
-- ============================================================================

-- Drop the old function
DROP FUNCTION IF EXISTS run_automatic_cleanup() CASCADE;

-- Recreate with fixes
CREATE OR REPLACE FUNCTION run_automatic_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_current_hour_brt INTEGER;
  v_config_hour INTEGER;
  v_last_run_date DATE;
  v_today_date DATE;
  v_request_id BIGINT;
  v_anon_key TEXT;
BEGIN
  -- Anon key for Edge Function authentication
  -- This is the public key that allows unauthenticated access to our Edge Functions
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdmJzdXByamh2ZXNid3libXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQxMDk0MzIsImV4cCI6MTk4OTY4OTQzMn0.JfMfL0rU5kHu9VCsN5X1_JUV_5XL8XZD7qmXQGz1X2U';

  -- Get current hour in BRT (UTC-3)
  v_current_hour_brt := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  v_today_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

  RAISE NOTICE 'Auto-Cleanup hourly check: Current BRT hour = %, Today date = %', 
    v_current_hour_brt, v_today_date;

  -- Get all enabled auto-cleanup configs
  FOR v_config IN
    SELECT 
      id,
      user_id,
      run_time,
      last_run_at,
      enabled
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

      RAISE NOTICE 'Auto-Cleanup: Triggering for user % at hour %, last_run: %', 
        v_config.user_id, v_config_hour, v_last_run_date;

      -- Call the Edge Function via net.http_post
      BEGIN
        SELECT net.http_post(
          url := 'https://ojvbsuprjhvesbwybmqc.supabase.co/functions/v1/run-post-reservation-cleanup',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_anon_key
          ),
          body := jsonb_build_object(
            'userId', v_config.user_id,
            'dryRun', false,
            'manual', false
          ),
          timeout_milliseconds := 30000
        ) INTO v_request_id;

        RAISE NOTICE 'Auto-Cleanup: HTTP request sent for user %, request_id: %', 
          v_config.user_id, v_request_id;

        -- Update last_run_at to NOW
        UPDATE auto_cleanup_config
        SET last_run_at = NOW()
        WHERE id = v_config.id;

      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Auto-Cleanup: Failed for user %: %', v_config.user_id, SQLERRM;
      END;

    END IF;
  END LOOP;

  RAISE NOTICE 'Auto-Cleanup hourly check completed';
  RETURN;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO postgres;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO authenticated;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO service_role;

-- Verify cron job exists
DO $$
BEGIN
  -- Check if job exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-cleanup-hourly-check') THEN
    RAISE NOTICE 'Auto-Cleanup cron job already exists';
  ELSE
    -- Create it
    PERFORM cron.schedule(
      'auto-cleanup-hourly-check',
      '0 * * * *',
      'SELECT run_automatic_cleanup();'
    );
    RAISE NOTICE 'Auto-Cleanup cron job created';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error checking/creating cron job: %', SQLERRM;
END $$;
