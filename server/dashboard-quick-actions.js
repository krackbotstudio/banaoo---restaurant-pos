import pool from './db.js';

const MAX = 6;

const CATALOG = [
  { id: 'new-order', title: 'New Order', description: 'Take dine-in or takeaway orders', href: '/orders/new', permission: 'orders' },
  { id: 'orders', title: 'Orders', description: 'Floor plan and open orders', href: '/orders', permission: 'orders' },
  { id: 'kitchen', title: 'Kitchen', description: 'Live order queue', href: '/kitchen', permission: 'kitchen' },
  { id: 'menu', title: 'Menu', description: 'Items and categories', href: '/menu', permission: 'menu' },
  { id: 'payments', title: 'Payments', description: 'Settlements and collections', href: '/payments', permission: 'payments' },
  { id: 'order-history', title: 'History', description: 'Past orders and reprints', href: '/order-history', permission: 'order-history' },
  { id: 'customers', title: 'Customers', description: 'Guest profiles and visits', href: '/customers', permission: 'customers' },
  { id: 'analytics', title: 'Analytics', description: 'Sales and performance', href: '/analytics', permission: 'analytics' },
  { id: 'outlets', title: 'Outlets', description: 'Locations and ordering links', href: '/outlets', permission: null, ownerOnly: true },
  { id: 'staff', title: 'Staff', description: 'Team and permissions', href: '/staff', permission: 'staff', ownerOnly: true },
  { id: 'settings', title: 'Settings', description: 'Account and billing', href: '/settings', permission: 'settings', ownerOnly: true },
  { id: 'integrations', title: 'Integrations', description: 'Swiggy, Zomato and more', href: '/integrations', permission: 'integrations' },
  { id: 'inventory', title: 'Inventory', description: 'Stock and ingredients', href: '/inventory', permission: 'inventory', feature: 'inventoryManagement' },
  { id: 'addons', title: 'Add-ons', description: 'Upgrade features', href: '/addons', permission: null, ownerOnly: true },
  { id: 'app-tour', title: 'App tour', description: 'Interactive walkthroughs', href: '/dashboard', permission: 'dashboard', isTour: true },
];

const DEFAULT_IDS = ['new-order', 'orders', 'kitchen', 'menu', 'payments', 'analytics'];

const catalogById = new Map(CATALOG.map((a) => [a.id, a]));

function normalizeIds(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function validateIds(ids) {
  if (!Array.isArray(ids)) return { error: 'action_ids must be an array' };
  if (ids.length < 1) return { error: 'Select at least one shortcut' };
  if (ids.length > MAX) return { error: `Maximum ${MAX} shortcuts allowed` };
  const seen = new Set();
  for (const id of ids) {
    if (!catalogById.has(id)) return { error: `Unknown action: ${id}` };
    if (seen.has(id)) return { error: 'Duplicate shortcuts are not allowed' };
    seen.add(id);
  }
  return { ids };
}

let quickActionsColumnReady = false;

async function ensureQuickActionsColumn() {
  if (quickActionsColumnReady) return;
  await pool.query(
    `ALTER TABLE public.profiles
     ADD COLUMN IF NOT EXISTS dashboard_quick_actions jsonb`
  );
  quickActionsColumnReady = true;
}

export function registerDashboardQuickActionRoutes(app, { requireAuth }) {
  app.get('/api/dashboard/quick-actions', requireAuth, async (req, res) => {
    try {
      let actionIds = null;
      if (!req.user.isStaff) {
        await ensureQuickActionsColumn();
        const { rows } = await pool.query(
          'SELECT dashboard_quick_actions FROM public.profiles WHERE user_id = $1 LIMIT 1',
          [req.user.id]
        );
        actionIds = normalizeIds(rows[0]?.dashboard_quick_actions);
      }

      res.json({
        action_ids: actionIds,
        default_ids: DEFAULT_IDS,
        max: MAX,
        catalog: CATALOG,
      });
    } catch (err) {
      console.error('GET /api/dashboard/quick-actions:', err);
      const message = err?.message || 'Failed to load quick actions';
      res.status(500).json({ error: message });
    }
  });

  app.put('/api/dashboard/quick-actions', requireAuth, async (req, res) => {
    if (req.user.isStaff) {
      return res.status(403).json({ error: 'Staff shortcuts are saved on this device only' });
    }
    const validation = validateIds(req.body?.action_ids);
    if (validation.error) return res.status(400).json({ error: validation.error });

    try {
      await ensureQuickActionsColumn();
      const { rows } = await pool.query(
        `UPDATE public.profiles
         SET dashboard_quick_actions = $1::jsonb
         WHERE user_id = $2
         RETURNING dashboard_quick_actions`,
        [JSON.stringify(validation.ids), req.user.id]
      );
      if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
      res.json({ action_ids: normalizeIds(rows[0].dashboard_quick_actions) });
    } catch (err) {
      console.error('PUT /api/dashboard/quick-actions:', err);
      res.status(500).json({ error: err.message });
    }
  });
}
