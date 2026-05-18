-- Required for Supabase Realtime postgres_changes filters (e.g. outlet_id=eq.<uuid>)
-- on the Kitchen Display subscription.
ALTER TABLE public.orders REPLICA IDENTITY FULL;
