-- ─────────────────────────────────────────────────────────────────────────────
-- Order Notifications Trigger
--
-- Automatically inserts a notification row for the outlet owner whenever:
--   • A new order is placed (INSERT)
--   • An order status changes (UPDATE on status column)
--
-- The real-time subscription in use-notifications.ts picks up the INSERT
-- and immediately surfaces it in the NotificationCenter bell icon.
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable realtime on notifications table so the client subscription works
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function
CREATE OR REPLACE FUNCTION public.notify_on_order_change()
RETURNS TRIGGER AS $$
DECLARE
  v_owner_id   UUID;
  v_title      TEXT;
  v_message    TEXT;
  v_table_info TEXT := '';
  v_source_tag TEXT := '';
BEGIN
  -- Resolve outlet owner
  SELECT owner_id INTO v_owner_id
    FROM public.outlets
   WHERE id = NEW.outlet_id;

  IF v_owner_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Build context strings
  IF NEW.table_number IS NOT NULL THEN
    v_table_info := ' · Table ' || NEW.table_number;
  END IF;

  IF NEW.source IS NOT NULL AND NEW.source != 'pos' THEN
    v_source_tag := ' [' || UPPER(NEW.source) || ']';
  END IF;

  -- ── New order received ──────────────────────────────────────────────────
  IF TG_OP = 'INSERT' THEN
    v_title   := 'New Order Received' || v_source_tag;
    v_message := 'Order #' || NEW.order_number
              || ' · ' || INITCAP(REPLACE(COALESCE(NEW.order_type, 'dine_in'), '_', ' '))
              || v_table_info
              || ' · ₹' || ROUND(COALESCE(NEW.total, 0))::TEXT;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_owner_id, 'order', v_title, v_message, '/orders');

  -- ── Order status changed ────────────────────────────────────────────────
  ELSIF TG_OP = 'UPDATE' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    v_title := CASE NEW.status
      WHEN 'preparing' THEN 'Order Being Prepared'
      WHEN 'ready'     THEN 'Order Ready for Pickup'
      WHEN 'completed' THEN 'Order Completed'
      WHEN 'cancelled' THEN 'Order Cancelled'
      ELSE                  'Order Updated'
    END;

    v_message := 'Order #' || NEW.order_number || ' — '
              || INITCAP(NEW.status)
              || CASE WHEN NEW.customer_name IS NOT NULL
                      THEN ' · ' || NEW.customer_name
                      ELSE v_table_info
                 END;

    INSERT INTO public.notifications (user_id, type, title, message, action_url)
    VALUES (v_owner_id, 'order', v_title, v_message, '/orders');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to orders table
DROP TRIGGER IF EXISTS on_order_notification ON public.orders;
CREATE TRIGGER on_order_notification
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_change();
