-- Adiciona campo opcional para definir a data da reserva no modo trigger_date
-- e restringe recorrência nesse modo para apenas 'once'

BEGIN;

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS reservation_date_override DATE NULL;

-- Restringe: quando trigger_mode = 'trigger_date', frequência deve ser 'once'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedules_trigger_date_once_only'
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_trigger_date_once_only
      CHECK (
        trigger_mode <> 'trigger_date' OR frequency = 'once'
      );
  END IF;
END$$;

COMMENT ON COLUMN public.schedules.reservation_date_override IS
  'Se definido e trigger_mode=trigger_date, usa esta data como data da reserva (YYYY-MM-DD). Caso contrário, mantém regra padrão (mesmo dia do disparo).';

COMMIT;
