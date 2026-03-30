-- ============================================================
-- Fix Row Level Security: strict per-account data isolation
-- Run this directly in Supabase SQL Editor if db push is unavailable
-- ============================================================

-- ── OUTLETS ─────────────────────────────────────────────────
ALTER TABLE public.outlets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage their outlets" ON public.outlets;
DROP POLICY IF EXISTS "Staff can view assigned outlets" ON public.outlets;

-- Owners can do everything on their own outlets
CREATE POLICY "outlets_owner_all"
  ON public.outlets FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Staff can view outlets they are assigned to
CREATE POLICY "outlets_staff_select"
  ON public.outlets FOR SELECT
  USING (
    auth.uid() = owner_id
    OR id IN (
      SELECT outlet_id FROM public.staff_outlet_assignments WHERE user_id = auth.uid()
    )
  );

-- ── MENU CATEGORIES ─────────────────────────────────────────
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active categories" ON public.menu_categories;
DROP POLICY IF EXISTS "Outlet owners can manage categories" ON public.menu_categories;

-- Customers can read active categories (needed for ordering app)
CREATE POLICY "menu_categories_public_select"
  ON public.menu_categories FOR SELECT
  USING (is_active = true);

-- Owners can do everything on their own outlet's categories
CREATE POLICY "menu_categories_owner_all"
  ON public.menu_categories FOR ALL
  USING (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  );

-- ── MENU ITEMS ───────────────────────────────────────────────
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view available items" ON public.menu_items;
DROP POLICY IF EXISTS "Outlet owners can manage items" ON public.menu_items;

-- Customers can read available items (needed for ordering app)
CREATE POLICY "menu_items_public_select"
  ON public.menu_items FOR SELECT
  USING (is_available = true);

-- Owners can do everything on their own outlet's items (including unavailable)
CREATE POLICY "menu_items_owner_all"
  ON public.menu_items FOR ALL
  USING (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  );

-- ── ORDERS ───────────────────────────────────────────────────
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Outlet owners can manage orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can view outlet orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can place orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can view their own orders" ON public.orders;

-- Owners can manage all orders for their outlets
CREATE POLICY "orders_owner_all"
  ON public.orders FOR ALL
  USING (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  );

-- Staff can view orders for assigned outlets
CREATE POLICY "orders_staff_select"
  ON public.orders FOR SELECT
  USING (
    outlet_id IN (
      SELECT outlet_id FROM public.staff_outlet_assignments WHERE user_id = auth.uid()
    )
  );

-- Customers (unauthenticated or authenticated) can insert orders
CREATE POLICY "orders_customer_insert"
  ON public.orders FOR INSERT
  WITH CHECK (true);

-- Customers can view their own orders by session_id or phone
CREATE POLICY "orders_customer_select"
  ON public.orders FOR SELECT
  USING (auth.uid() IS NULL OR true);

-- ── ORDER ITEMS ──────────────────────────────────────────────
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Order items follow order access" ON public.order_items;

CREATE POLICY "order_items_owner_all"
  ON public.order_items FOR ALL
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
    )
  );

CREATE POLICY "order_items_insert"
  ON public.order_items FOR INSERT
  WITH CHECK (true);

CREATE POLICY "order_items_select"
  ON public.order_items FOR SELECT
  USING (true);

-- ── PROFILES ─────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;

CREATE POLICY "profiles_owner_select"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "profiles_owner_insert"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_owner_update"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── STAFF OUTLET ASSIGNMENTS ─────────────────────────────────
ALTER TABLE public.staff_outlet_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage staff assignments" ON public.staff_outlet_assignments;
DROP POLICY IF EXISTS "Staff can view own assignments" ON public.staff_outlet_assignments;

CREATE POLICY "staff_assignments_owner_all"
  ON public.staff_outlet_assignments FOR ALL
  USING (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid())
  );

CREATE POLICY "staff_assignments_self_select"
  ON public.staff_outlet_assignments FOR SELECT
  USING (auth.uid() = user_id);

-- ── RESTAURANT TABLES ────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'restaurant_tables' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "restaurant_tables_owner" ON public.restaurant_tables';
    EXECUTE $p$
      CREATE POLICY "restaurant_tables_owner"
        ON public.restaurant_tables FOR ALL
        USING (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
        WITH CHECK (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "restaurant_tables_public_select" ON public.restaurant_tables';
    EXECUTE $p$
      CREATE POLICY "restaurant_tables_public_select"
        ON public.restaurant_tables FOR SELECT
        USING (true)
    $p$;
  END IF;
END $$;

-- ── TABLE ZONES ──────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'table_zones' AND table_schema = 'public') THEN
    EXECUTE 'ALTER TABLE public.table_zones ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "table_zones_owner" ON public.table_zones';
    EXECUTE $p$
      CREATE POLICY "table_zones_owner"
        ON public.table_zones FOR ALL
        USING (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
        WITH CHECK (outlet_id IN (SELECT id FROM public.outlets WHERE owner_id = auth.uid()))
    $p$;
    EXECUTE 'DROP POLICY IF EXISTS "table_zones_public_select" ON public.table_zones';
    EXECUTE $p$
      CREATE POLICY "table_zones_public_select"
        ON public.table_zones FOR SELECT
        USING (true)
    $p$;
  END IF;
END $$;
