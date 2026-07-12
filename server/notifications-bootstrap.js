import pool from './db.js';

let notificationsInfraReady = false;

/**
 * Ensures notifications table realtime + order-change trigger exist.
 * This keeps in-app notifications working even if migrations were skipped.
 */
export async function ensureNotificationsInfra() {
  if (notificationsInfraReady) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        type TEXT NOT NULL DEFAULT 'system',
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        read BOOLEAN NOT NULL DEFAULT false,
        action_url TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created
        ON public.notifications (user_id, created_at DESC)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_unread
        ON public.notifications (user_id, read)
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = 'notifications'
          ) THEN
            ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
          END IF;
        END IF;
      END
      $$;
    `);

    await pool.query(`
      CREATE OR REPLACE FUNCTION public.notify_on_order_change()
      RETURNS TRIGGER AS $$
      DECLARE
        v_owner_id   UUID;
        v_title      TEXT;
        v_message    TEXT;
        v_table_info TEXT := '';
        v_source_tag TEXT := '';
      BEGIN
        SELECT owner_id INTO v_owner_id
          FROM public.outlets
         WHERE id = NEW.outlet_id;

        IF v_owner_id IS NULL THEN
          RETURN NEW;
        END IF;

        IF NEW.table_number IS NOT NULL THEN
          v_table_info := ' · Table ' || NEW.table_number;
        END IF;

        IF NEW.source IS NOT NULL AND NEW.source != 'pos' THEN
          v_source_tag := ' [' || UPPER(NEW.source) || ']';
        END IF;

        IF TG_OP = 'INSERT' THEN
          v_title   := 'New Order Received' || v_source_tag;
          v_message := 'Order #' || NEW.order_number
                    || ' · ' || INITCAP(REPLACE(COALESCE(NEW.order_type, 'dine_in'), '_', ' '))
                    || v_table_info
                    || ' · ₹' || ROUND(COALESCE(NEW.total, 0))::TEXT;

          INSERT INTO public.notifications (user_id, type, title, message, action_url)
          VALUES (v_owner_id, 'order', v_title, v_message, '/orders');

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
    `);

    await pool.query(`
      DROP TRIGGER IF EXISTS on_order_notification ON public.orders;
      CREATE TRIGGER on_order_notification
        AFTER INSERT OR UPDATE OF status ON public.orders
        FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_change();
    `);

    notificationsInfraReady = true;
  } catch (err) {
    console.warn('Warning: Could not verify or update notifications infrastructure (likely permission/owner restriction):', err.message);
    notificationsInfraReady = true;
  }
}
