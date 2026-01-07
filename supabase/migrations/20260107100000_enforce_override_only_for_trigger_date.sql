-- Garante que reservation_date_override só seja usado quando trigger_mode='trigger_date'

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schedules_override_only_with_trigger_date'
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_override_only_with_trigger_date
      CHECK (
        reservation_date_override IS NULL OR trigger_mode = 'trigger_date'
      );
  END IF;
END$$;

COMMIT;
