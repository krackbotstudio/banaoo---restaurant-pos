/**
 * Create dashboard_banners table (if missing) and seed carousel slides.
 *
 * Usage (from repo root):
 *   node server/scripts/seed-dashboard-banners.js
 *   node server/scripts/seed-dashboard-banners.js --refresh   # clear and reseed
 *
 * Requires DATABASE_URL in .env
 */
import pool from '../db.js';

const BANNERS = [
  {
    kind: 'news',
    title: 'Visual floor plan is live',
    description:
      'See dine-in tables, takeaway, and online orders on one screen. Tap any spot to start or manage orders during service.',
    cta_label: 'Open orders',
    href: '/orders',
    cta_action: 'link',
    theme: 'warm',
    sort_order: 10,
    starts_at: null,
    ends_at: null,
  },
  {
    kind: 'offer',
    title: 'Save 20% on annual plans',
    description:
      'Lock in Launcher or Growth for 12 months. Renew or switch plans anytime under Settings → Subscription.',
    cta_label: 'View plans',
    href: '/settings?tab=subscription',
    cta_action: 'link',
    theme: 'offer',
    sort_order: 20,
    starts_at: null,
    ends_at: '2026-12-31',
  },
  {
    kind: 'commercial',
    title: 'Connect Swiggy & Zomato',
    description:
      'Add delivery integrations, extra outlets, inventory, and customer ordering from the Add-ons page.',
    cta_label: 'Explore add-ons',
    href: '/addons',
    cta_action: 'link',
    theme: 'violet',
    sort_order: 30,
    starts_at: null,
    ends_at: null,
  },
  {
    kind: 'commercial',
    title: 'Train your team in minutes',
    description:
      'Interactive tours for Dashboard, Orders, Menu, and Kitchen. Tap the info icon in the top bar to start.',
    cta_label: 'Start a tour',
    href: null,
    cta_action: 'open_tour',
    theme: 'cool',
    sort_order: 40,
    starts_at: null,
    ends_at: null,
  },
  {
    kind: 'news',
    title: 'Billing hub in Settings',
    description:
      'View invoices, save cards or UPI, track add-ons, and manage auto pay from Settings → Subscription.',
    cta_label: 'Open billing',
    href: '/settings?tab=subscription',
    cta_action: 'link',
    theme: 'cool',
    sort_order: 50,
    starts_at: null,
    ends_at: null,
  },
  {
    kind: 'news',
    title: 'Online ordering links per outlet',
    description:
      'Share brand and outlet ordering URLs with customers. Set them up under Settings → Outlets.',
    cta_label: 'Set up links',
    href: '/settings?tab=outlets',
    cta_action: 'link',
    theme: 'warm',
    sort_order: 60,
    starts_at: null,
    ends_at: null,
  },
];

async function ensureTable() {
  await pool.query(`
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
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_dashboard_banners_active
      ON public.dashboard_banners (is_active, sort_order);
  `);
}

async function main() {
  const refresh = process.argv.includes('--refresh');
  await ensureTable();

  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM public.dashboard_banners'
  );
  const existing = countRows[0]?.count ?? 0;

  if (existing > 0 && !refresh) {
    console.log(`dashboard_banners already has ${existing} row(s). Use --refresh to replace.`);
    const { rows } = await pool.query(
      `SELECT title, kind, is_active FROM public.dashboard_banners ORDER BY sort_order`
    );
    rows.forEach((r) => console.log(`  - [${r.kind}] ${r.title} (active=${r.is_active})`));
    return;
  }

  if (refresh && existing > 0) {
    await pool.query('DELETE FROM public.dashboard_banners');
    console.log(`Cleared ${existing} existing banner(s).`);
  }

  for (const b of BANNERS) {
    await pool.query(
      `INSERT INTO public.dashboard_banners (
        kind, title, description, cta_label, href, cta_action, theme, sort_order, is_active, starts_at, ends_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9,$10)`,
      [
        b.kind,
        b.title,
        b.description,
        b.cta_label,
        b.href,
        b.cta_action,
        b.theme,
        b.sort_order,
        b.starts_at,
        b.ends_at,
      ]
    );
  }

  console.log(`Seeded ${BANNERS.length} dashboard banner(s).`);
  console.log('Manage them at /cms/banners — they appear on the restaurant /dashboard carousel.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
