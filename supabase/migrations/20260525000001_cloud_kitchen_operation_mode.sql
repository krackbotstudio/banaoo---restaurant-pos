-- ─────────────────────────────────────────────────────────────────────────────
-- Cloud-kitchen / counter-format outlet operation_mode backfill + enforcement
--
-- Before this migration, an outlet's `operation_mode` was independent of the
-- owner's `business_type`. Cloud kitchens and QSRs that signed up before the
-- business-type auto-seed shipped ended up with operation_mode = 'standard',
-- which makes the POS show a Dine-In / table-selection step that doesn't
-- belong to them.
--
-- This migration:
--   1. Backfills operation_mode = 'self_service' for any existing outlet whose
--      owner's business_type implies counter / delivery formats and which is
--      still on the default 'standard' mode.
--   2. Installs a BEFORE INSERT/UPDATE trigger that auto-corrects
--      operation_mode for cloud-kitchen owners so the UI can never drift back
--      to 'standard' for them.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Backfill ────────────────────────────────────────────────────────────
UPDATE public.outlets o
   SET operation_mode = 'self_service'
  FROM public.profiles p
 WHERE o.owner_id = p.user_id
   AND p.business_type IN ('cloud_kitchen', 'qsr', 'sweet_shop', 'bakery', 'food_cart')
   AND o.operation_mode = 'standard';

-- ── 2. Enforcement trigger ─────────────────────────────────────────────────
-- Cloud kitchens have no counter / no tables — operation_mode is always
-- self_service for them. Lock it at the DB layer so a UI bug or a direct API
-- call can't get the data into an inconsistent state.
CREATE OR REPLACE FUNCTION public.enforce_cloud_kitchen_self_service()
RETURNS TRIGGER AS $$
DECLARE
  v_business_type text;
BEGIN
  SELECT business_type
    INTO v_business_type
    FROM public.profiles
   WHERE user_id = NEW.owner_id;

  IF v_business_type = 'cloud_kitchen' AND NEW.operation_mode <> 'self_service' THEN
    NEW.operation_mode := 'self_service';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS enforce_cloud_kitchen_mode ON public.outlets;
CREATE TRIGGER enforce_cloud_kitchen_mode
  BEFORE INSERT OR UPDATE OF operation_mode, owner_id ON public.outlets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cloud_kitchen_self_service();

COMMENT ON FUNCTION public.enforce_cloud_kitchen_self_service IS
  'Locks outlets.operation_mode to self_service for owners whose profiles.business_type is cloud_kitchen.';
