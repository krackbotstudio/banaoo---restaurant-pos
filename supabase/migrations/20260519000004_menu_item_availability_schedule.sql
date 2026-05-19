-- Per-item day/time availability (breakfast-only, weekend specials, etc.)

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS availability_schedule JSONB NULL;

COMMENT ON COLUMN public.menu_items.schedule_enabled IS 'When true, item is only orderable inside availability_schedule windows';
COMMENT ON COLUMN public.menu_items.availability_schedule IS 'JSON: { timezone, windows: [{ days: [0-6], start: "HH:mm", end: "HH:mm" }] } — 0=Sunday';

-- Effective availability for customer-facing SELECT (0=Sun … 6=Sat, matches JS Date.getDay())
CREATE OR REPLACE FUNCTION public.menu_item_is_orderable(
  p_is_available BOOLEAN,
  p_schedule_enabled BOOLEAN,
  p_schedule JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  tz TEXT;
  local_ts TIMESTAMP;
  dow INT;
  t TIME;
  win JSONB;
  start_t TIME;
  end_t TIME;
BEGIN
  IF NOT COALESCE(p_is_available, false) THEN
    RETURN false;
  END IF;

  IF NOT COALESCE(p_schedule_enabled, false)
     OR p_schedule IS NULL
     OR jsonb_array_length(COALESCE(p_schedule->'windows', '[]'::jsonb)) = 0 THEN
    RETURN true;
  END IF;

  tz := COALESCE(NULLIF(trim(p_schedule->>'timezone'), ''), 'Asia/Kolkata');
  local_ts := timezone(tz, now());
  dow := EXTRACT(DOW FROM local_ts)::INT;
  t := local_ts::TIME;

  FOR win IN SELECT * FROM jsonb_array_elements(p_schedule->'windows')
  LOOP
    IF win->'days' IS NOT NULL AND jsonb_array_length(win->'days') > 0 THEN
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(win->'days') AS d(day_text)
        WHERE day_text::INT = dow
      ) THEN
        CONTINUE;
      END IF;
    END IF;

    BEGIN
      start_t := (win->>'start')::TIME;
      end_t := (win->>'end')::TIME;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    IF start_t IS NULL OR end_t IS NULL THEN
      CONTINUE;
    END IF;

    IF start_t <= end_t THEN
      IF t >= start_t AND t < end_t THEN
        RETURN true;
      END IF;
    ELSE
      IF t >= start_t OR t < end_t THEN
        RETURN true;
      END IF;
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

DROP POLICY IF EXISTS "menu_items_public_select" ON public.menu_items;

CREATE POLICY "menu_items_public_select"
  ON public.menu_items FOR SELECT
  USING (
    public.menu_item_is_orderable(
      is_available,
      schedule_enabled,
      availability_schedule
    )
  );
