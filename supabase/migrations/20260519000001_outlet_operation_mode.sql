-- Outlet operation mode: standard table service vs self-service counter flow.
ALTER TABLE public.outlets
  ADD COLUMN IF NOT EXISTS operation_mode text NOT NULL DEFAULT 'standard';

ALTER TABLE public.outlets
  DROP CONSTRAINT IF EXISTS outlets_operation_mode_check;

ALTER TABLE public.outlets
  ADD CONSTRAINT outlets_operation_mode_check
  CHECK (operation_mode IN ('standard', 'self_service'));

COMMENT ON COLUMN public.outlets.operation_mode IS
  'standard = table/KDS flow; self_service = counter orders print kitchen bill + customer token';
