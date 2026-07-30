import type { FeatureKey } from "@/hooks/use-feature-gating";
import { businessHasTables } from "@/lib/business-types";

export const QUICK_ACTIONS_STORAGE_KEY = "banaoo_dashboard_quick_actions";
export const MAX_QUICK_ACTIONS = 6;

export type QuickActionId =
  | "new-order"
  | "orders"
  | "kitchen"
  | "menu"
  | "payments"
  | "order-history"
  | "customers"
  | "analytics"
  | "outlets"
  | "staff"
  | "settings"
  | "integrations"
  | "inventory"
  | "addons"
  | "app-tour";

export interface QuickActionDefinition {
  id: QuickActionId;
  title: string;
  description: string;
  href: string;
  /** Sidebar permission key; null = always allowed when authenticated */
  permission: string | null;
  ownerOnly?: boolean;
  feature?: FeatureKey;
  /** Opens app tour instead of navigating */
  isTour?: boolean;
}

/** Default top 6 for new users */
export const DEFAULT_QUICK_ACTION_IDS: QuickActionId[] = [
  "new-order",
  "orders",
  "kitchen",
  "menu",
  "payments",
  "analytics",
];

export const QUICK_ACTION_CATALOG: QuickActionDefinition[] = [
  {
    id: "new-order",
    title: "New Order",
    description: "Take dine-in or takeaway orders",
    href: "/orders/new",
    permission: "orders",
  },
  {
    id: "orders",
    title: "Orders",
    description: "Floor plan and open orders",
    href: "/orders",
    permission: "orders",
  },
  {
    id: "kitchen",
    title: "Kitchen",
    description: "Live order queue",
    href: "/kitchen",
    permission: "kitchen",
  },
  {
    id: "menu",
    title: "Menu",
    description: "Items and categories",
    href: "/menu",
    permission: "menu",
  },
  {
    id: "payments",
    title: "Payments",
    description: "Settlements and collections",
    href: "/payments",
    permission: "payments",
  },
  {
    id: "order-history",
    title: "History",
    description: "Past orders and reprints",
    href: "/order-history",
    permission: "order-history",
  },
  {
    id: "customers",
    title: "Customers",
    description: "Guest profiles and visits",
    href: "/customers",
    permission: "customers",
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "Sales and performance",
    href: "/analytics",
    permission: "analytics",
  },
  {
    id: "outlets",
    title: "Outlets",
    description: "Locations and ordering links",
    href: "/outlets",
    permission: null,
    ownerOnly: true,
  },
  {
    id: "staff",
    title: "Staff",
    description: "Team and permissions",
    href: "/staff",
    permission: "staff",
    ownerOnly: true,
  },
  {
    id: "settings",
    title: "Settings",
    description: "Account and billing",
    href: "/settings",
    permission: "settings",
    ownerOnly: true,
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Swiggy, Zomato and more",
    href: "/integrations",
    permission: "integrations",
  },
  {
    id: "inventory",
    title: "Inventory",
    description: "Stock and ingredients",
    href: "/inventory",
    permission: "inventory",
    feature: "inventoryManagement",
  },
  {
    id: "addons",
    title: "Add-ons",
    description: "Upgrade features",
    href: "/addons",
    permission: null,
    ownerOnly: true,
  },
  {
    id: "app-tour",
    title: "App tour",
    description: "Interactive walkthroughs",
    href: "/dashboard",
    permission: "dashboard",
    isTour: true,
  },
];

const catalogById = new Map(QUICK_ACTION_CATALOG.map((a) => [a.id, a]));

export function getQuickActionDefinition(id: string): QuickActionDefinition | undefined {
  return catalogById.get(id as QuickActionId);
}

/** Adapt quick-action copy for table-less businesses (cloud kitchen, QSR, …). */
export function withBusinessAwareQuickAction(
  action: QuickActionDefinition,
  businessType?: string | null
): QuickActionDefinition {
  if (businessHasTables(businessType)) return action;
  if (action.id === "new-order") {
    return {
      ...action,
      description:
        businessType === "cloud_kitchen"
          ? "Take delivery and takeaway orders"
          : "Take counter and takeaway orders",
    };
  }
  if (action.id === "orders") {
    return {
      ...action,
      description: "Open takeaway and online orders",
    };
  }
  return action;
}

export type CanAccessQuickAction = (action: QuickActionDefinition) => boolean;

export function filterAccessibleQuickActions(
  actions: QuickActionDefinition[],
  canAccess: CanAccessQuickAction
) {
  return actions.filter(canAccess);
}

export function resolveQuickActionIds(
  savedIds: string[] | null | undefined,
  canAccess: CanAccessQuickAction
): QuickActionId[] {
  const validSaved = (savedIds ?? [])
    .map((id) => getQuickActionDefinition(id))
    .filter((a): a is QuickActionDefinition => !!a && canAccess(a))
    .map((a) => a.id);

  if (validSaved.length > 0) {
    return validSaved.slice(0, MAX_QUICK_ACTIONS);
  }

  return DEFAULT_QUICK_ACTION_IDS.filter((id) => {
    const def = getQuickActionDefinition(id);
    return def && canAccess(def);
  }).slice(0, MAX_QUICK_ACTIONS);
}

export function readStaffQuickActionIds(): string[] | null {
  try {
    const raw = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}

export function writeStaffQuickActionIds(ids: QuickActionId[]) {
  localStorage.setItem(QUICK_ACTIONS_STORAGE_KEY, JSON.stringify(ids));
}
