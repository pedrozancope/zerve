-- ============================================================================
-- Migration: Create more frequent cron job (every minute) for debugging
-- ============================================================================
-- Changing from hourly to every minute to ensure it runs
-- The function will still only execute if conditions are met

DO $$
BEGIN
  -- Unschedule the old hourly job if it exists
  PERFORM cron.unschedule('auto-cleanup-hourly-check');
  RAISE NOTICE 'Unscheduled old auto-cleanup-hourly-check job';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Old job did not exist or error: %', SQLERRM;
END $$;

-- Create a new job that runs every minute
DO $$
BEGIN
  PERFORM cron.schedule(
    'auto-cleanup-every-minute',
    '* * * * *',  -- Every minute
    'SELECT run_automatic_cleanup();'
  );
  RAISE NOTICE 'Scheduled auto-cleanup-every-minute job';
END $$;

-- Verify the job was created
SELECT cron.schedule(
  'auto-cleanup-every-minute',
  '* * * * *',
  'SELECT run_automatic_cleanup();'
);
