-- Staff Members table (owner-managed, no Supabase auth required for staff)
-- Each restaurant owner manages their own staff records directly.

CREATE TABLE IF NOT EXISTS public.staff_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL,
  phone       TEXT,
  email       TEXT,
  role        TEXT        NOT NULL DEFAULT 'staff'
                CHECK (role IN ('manager', 'chef', 'waiter', 'cashier', 'staff')),
  pin_code    TEXT        CHECK (pin_code IS NULL OR (length(pin_code) = 4 AND pin_code ~ '^\d{4}$')),
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Junction: staff member ↔ outlet (many-to-many)
CREATE TABLE IF NOT EXISTS public.staff_outlet_links (
  staff_member_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  outlet_id       UUID NOT NULL REFERENCES public.outlets(id)       ON DELETE CASCADE,
  PRIMARY KEY (staff_member_id, outlet_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_staff_members_owner ON public.staff_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_staff_outlet_links_outlet ON public.staff_outlet_links(outlet_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.touch_staff_members()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_staff_members ON public.staff_members;
CREATE TRIGGER trg_touch_staff_members
  BEFORE UPDATE ON public.staff_members
  FOR EACH ROW EXECUTE FUNCTION public.touch_staff_members();

-- Row-Level Security
ALTER TABLE public.staff_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_outlet_links ENABLE ROW LEVEL SECURITY;

-- Owners can do anything with their own staff
CREATE POLICY "owners_manage_staff"
  ON public.staff_members FOR ALL
  USING  (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Owners can manage outlet links for their staff
CREATE POLICY "owners_manage_staff_links"
  ON public.staff_outlet_links FOR ALL
  USING  (EXISTS (SELECT 1 FROM public.staff_members
                  WHERE id = staff_member_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.staff_members
                      WHERE id = staff_member_id AND owner_id = auth.uid()));
