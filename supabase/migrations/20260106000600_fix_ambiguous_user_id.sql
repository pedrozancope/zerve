-- Fix the ambiguous column reference error

DROP FUNCTION IF EXISTS run_automatic_cleanup() CASCADE;

CREATE OR REPLACE FUNCTION run_automatic_cleanup()
RETURNS TABLE (
  step TEXT,
  message TEXT,
  config_id UUID,
  user_id_out UUID,
  config_hour INTEGER,
  current_hour_brt INTEGER,
  last_run_date DATE,
  today_date DATE,
  should_run BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_config RECORD;
  v_current_hour_brt INTEGER;
  v_config_hour INTEGER;
  v_last_run_date DATE;
  v_today_date DATE;
  v_user_id UUID;
BEGIN
  -- Get current time in BRT
  v_current_hour_brt := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'));
  v_today_date := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;

  -- Return initial info
  step := 'init';
  message := 'Auto-Cleanup check starting';
  config_id := NULL;
  user_id_out := NULL;
  config_hour := NULL;
  current_hour_brt := v_current_hour_brt;
  last_run_date := NULL;
  today_date := v_today_date;
  should_run := false;
  RETURN NEXT;

  -- Check if any configs exist
  IF NOT EXISTS (SELECT 1 FROM auto_cleanup_config WHERE enabled = true) THEN
    step := 'no_config';
    message := 'No enabled auto-cleanup configs found';
    RETURN NEXT;
    RETURN;
  END IF;

  step := 'config_found';
  message := 'Found enabled auto-cleanup config(s)';
  RETURN NEXT;

  -- Process each enabled config
  FOR v_config IN
    SELECT 
      auto_cleanup_config.id,
      auto_cleanup_config.user_id,
      auto_cleanup_config.run_time,
      auto_cleanup_config.last_run_at,
      auto_cleanup_config.enabled
    FROM auto_cleanup_config
    WHERE auto_cleanup_config.enabled = true
  LOOP
    config_id := v_config.id;
    v_user_id := v_config.user_id;
    user_id_out := v_user_id;
    v_config_hour := EXTRACT(HOUR FROM v_config.run_time::TIME);
    config_hour := v_config_hour;
    
    IF v_config.last_run_at IS NOT NULL THEN
      v_last_run_date := (v_config.last_run_at AT TIME ZONE 'America/Sao_Paulo')::DATE;
    ELSE
      v_last_run_date := NULL;
    END IF;

    last_run_date := v_last_run_date;
    
    -- Determine if should run
    should_run := (v_current_hour_brt = v_config_hour AND 
                   (v_last_run_date IS NULL OR v_last_run_date < v_today_date));

    step := 'checking_config';
    message := format('Config check: user=%s, config_hour=%s, current_hour=%s, last_run=%s, should_run=%s',
      v_user_id, v_config_hour, v_current_hour_brt, v_last_run_date, should_run);
    RETURN NEXT;

    IF should_run THEN
      step := 'updating_last_run';
      message := format('Updating last_run_at for user %s', v_user_id);
      RETURN NEXT;

      -- Update immediately
      UPDATE auto_cleanup_config
      SET last_run_at = NOW()
      WHERE id = v_config.id;

      step := 'calling_http';
      message := format('Calling HTTP for user %s', v_user_id);
      RETURN NEXT;

      -- Call Edge Function
      BEGIN
        PERFORM net.http_post(
          url := 'https://ojvbsuprjhvesbwybmqc.supabase.co/functions/v1/run-post-reservation-cleanup',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdmJzdXByamh2ZXNid3libXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDQxMDk0MzIsImV4cCI6MTk4OTY4OTQzMn0.JfMfL0rU5kHu9VCsN5X1_JUV_5XL8XZD7qmXQGz1X2U'
          ),
          body := jsonb_build_object(
            'userId', v_user_id::text,
            'dryRun', false,
            'manual', false
          ),
          timeout_milliseconds := 60000
        );

        step := 'http_success';
        message := format('HTTP request sent successfully for user %s', v_user_id);
        RETURN NEXT;

      EXCEPTION WHEN OTHERS THEN
        step := 'http_error';
        message := format('HTTP error for user %s: %s', v_user_id, SQLERRM);
        RETURN NEXT;
      END;
    ELSE
      step := 'skipped';
      message := format('Skipped (hour_match=%s, not_run_today=%s)',
        v_current_hour_brt = v_config_hour,
        v_last_run_date IS NULL OR v_last_run_date < v_today_date);
      RETURN NEXT;
    END IF;
  END LOOP;

  step := 'completed';
  message := 'Auto-Cleanup check completed';
  RETURN NEXT;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO postgres;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO authenticated;
GRANT EXECUTE ON FUNCTION run_automatic_cleanup() TO service_role;
