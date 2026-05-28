-- Dashboard carousel banners (managed from Tectangle CMS)
CREATE TABLE IF NOT EXISTS public.dashboard_banners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL DEFAULT 'news'
                CHECK (kind IN ('news', 'offer', 'commercial')),
  title         text NOT NULL,
  description   text NOT NULL,
  cta_label     text,
  href          text,
  cta_action    text CHECK (cta_action IS NULL OR cta_action IN ('open_tour', 'link')),
  theme         text NOT NULL DEFAULT 'warm'
                CHECK (theme IN ('warm', 'cool', 'offer', 'violet')),
  sort_order    int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  starts_at     date,
  ends_at       date,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_banners_active
  ON public.dashboard_banners (is_active, sort_order);

ALTER TABLE public.dashboard_banners ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.dashboard_banners IS
  'Restaurant dashboard carousel — edited in CMS at /cms/banners.';

-- Seed initial slides (safe to edit/remove in CMS)
INSERT INTO public.dashboard_banners (
  kind, title, description, cta_label, href, cta_action, theme, sort_order, is_active, starts_at
) VALUES
  (
    'news',
    'Visual floor plan is live',
    'See dine-in tables, takeaway, and online orders on one screen. Tap any spot to start or manage orders during service.',
    'Try it now',
    '/orders',
    'link',
    'warm',
    10,
    true,
    '2026-05-01'
  ),
  (
    'offer',
    'Save 20% on annual plans',
    'Lock in Launcher or Growth for 12 months and cut your subscription cost. Renew or upgrade from Settings → Subscription.',
    'View plans',
    '/settings?tab=subscription',
    'link',
    'offer',
    20,
    true,
    NULL
  ),
  (
    'commercial',
    'Power up with add-ons',
    'Swiggy & Zomato integrations, extra outlets, inventory, and customer ordering — flexible billing terms.',
    'Explore add-ons',
    '/addons',
    'link',
    'violet',
    30,
    true,
    NULL
  ),
  (
    'commercial',
    'Train your team in minutes',
    'Interactive tours for Dashboard, Orders, Menu, and Kitchen. Open the info icon in the top bar whenever someone needs a refresher.',
    'Start a tour',
    NULL,
    'open_tour',
    'cool',
    40,
    true,
    NULL
  ),
  (
    'news',
    'Manage billing in one place',
    'Invoices, saved cards, UPI, auto pay, and add-on trackers are under Settings → Subscription.',
    'Open billing',
    '/settings?tab=subscription',
    'link',
    'cool',
    50,
    true,
    '2026-05-27'
  );
