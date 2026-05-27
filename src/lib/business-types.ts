// Single source of truth for restaurant business types.
//
// Each entry carries:
//   - presentation metadata (label, description, icon)
//   - a `comingSoon` flag so we can list new categories in the picker
//     without enabling type-specific behavior yet
//   - a `defaultOperationMode` that gets auto-applied to the first outlet
//     created during onboarding (and to outlets created later via the API)
//   - a `capabilities` map that downstream UI can branch on
//     (currently informational — concrete gating per capability is added
//     incrementally in follow-up PRs)

import {
  UtensilsCrossed,
  Building2,
  ChefHat,
  Coffee,
  Zap,
  Wine,
  Cake,
  Croissant,
  Truck,
  Martini,
  Store,
  Utensils,
  Package,
  type LucideIcon,
} from "lucide-react";

import type { OutletOperationMode } from "./outlet-operation";

export type BusinessType =
  | "restaurant"
  | "hotel"
  | "cloud_kitchen"
  | "cafe"
  | "qsr"
  | "bar"
  // Coming soon — visible in the picker but disabled until their
  // specific behaviors (modifiers / weight-pricing / advance orders /
  // open tabs) are implemented.
  | "sweet_shop"
  | "bakery"
  | "food_cart"
  | "resto_bar";

export interface BusinessCapabilities {
  /** Has a dining floor with tables that get assigned to orders. */
  hasTables: boolean;
  /** Accepts reservations / table bookings (not yet implemented anywhere). */
  hasReservations: boolean;
  /** Runs a KDS / kitchen prep flow. */
  hasKitchen: boolean;
  /** Delivers orders (self or via aggregators). */
  hasDelivery: boolean;
  /** Takes orders at a billing counter (token-based flow). */
  hasCounterService: boolean;
  /** Needs modifier groups on menu items (flavors, sizes, add-ons). */
  needsModifiers: boolean;
  /** Sells items priced by weight or per-piece (sweets, savouries). */
  needsWeightPricing: boolean;
  /** Takes advance / pre-orders with a pickup date (cakes, bulk). */
  needsAdvanceOrders: boolean;
  /** Runs open tabs across a session (bars, lounges). */
  needsOpenTabs: boolean;
}

export interface BusinessTypeDefinition {
  id: BusinessType;
  label: string;
  description: string;
  icon: LucideIcon;
  /** True while behavior for this type is still being built. */
  comingSoon?: boolean;
  defaultOperationMode: OutletOperationMode;
  capabilities: BusinessCapabilities;
}

const BASE_CAPS: BusinessCapabilities = {
  hasTables: true,
  hasReservations: false,
  hasKitchen: true,
  hasDelivery: false,
  hasCounterService: false,
  needsModifiers: false,
  needsWeightPricing: false,
  needsAdvanceOrders: false,
  needsOpenTabs: false,
};

export const BUSINESS_TYPES: BusinessTypeDefinition[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    description: "Dine-in & takeaway",
    icon: UtensilsCrossed,
    defaultOperationMode: "standard",
    capabilities: { ...BASE_CAPS, hasDelivery: true },
  },
  {
    id: "hotel",
    label: "Hotel",
    description: "Hotel dining & room service",
    icon: Building2,
    defaultOperationMode: "standard",
    capabilities: { ...BASE_CAPS, hasReservations: true },
  },
  {
    id: "cloud_kitchen",
    label: "Cloud Kitchen",
    description: "Delivery-only kitchen",
    icon: ChefHat,
    defaultOperationMode: "self_service",
    capabilities: {
      ...BASE_CAPS,
      hasTables: false,
      hasDelivery: true,
      hasCounterService: false,
    },
  },
  {
    id: "cafe",
    label: "Cafe",
    description: "Coffee shop & cafe",
    icon: Coffee,
    defaultOperationMode: "standard",
    capabilities: { ...BASE_CAPS, hasCounterService: true },
  },
  {
    id: "qsr",
    label: "QSR",
    description: "Quick service restaurant",
    icon: Zap,
    defaultOperationMode: "self_service",
    capabilities: { ...BASE_CAPS, hasTables: false, hasCounterService: true },
  },
  {
    id: "bar",
    label: "Bar & Lounge",
    description: "Bar, pub & lounge",
    icon: Wine,
    defaultOperationMode: "standard",
    capabilities: { ...BASE_CAPS, needsOpenTabs: true },
  },

  // ── Coming soon ────────────────────────────────────────────────────────────
  {
    id: "sweet_shop",
    label: "Sweet Shop",
    description: "Sweets & savouries by weight",
    icon: Cake,
    comingSoon: true,
    defaultOperationMode: "self_service",
    capabilities: {
      ...BASE_CAPS,
      hasTables: false,
      hasCounterService: true,
      needsModifiers: true,
      needsWeightPricing: true,
      needsAdvanceOrders: true,
    },
  },
  {
    id: "bakery",
    label: "Bakery",
    description: "Cakes, breads & advance orders",
    icon: Croissant,
    comingSoon: true,
    defaultOperationMode: "self_service",
    capabilities: {
      ...BASE_CAPS,
      hasTables: false,
      hasCounterService: true,
      needsModifiers: true,
      needsAdvanceOrders: true,
    },
  },
  {
    id: "food_cart",
    label: "Food Cart",
    description: "Street food & on-the-go billing",
    icon: Truck,
    comingSoon: true,
    defaultOperationMode: "self_service",
    capabilities: {
      ...BASE_CAPS,
      hasTables: false,
      hasCounterService: true,
    },
  },
  {
    id: "resto_bar",
    label: "Resto Bar",
    description: "Restaurant + bar with open tabs",
    icon: Martini,
    comingSoon: true,
    defaultOperationMode: "standard",
    capabilities: {
      ...BASE_CAPS,
      hasDelivery: true,
      needsModifiers: true,
      needsOpenTabs: true,
    },
  },
];

const BUSINESS_TYPE_BY_ID: Record<string, BusinessTypeDefinition> = Object.fromEntries(
  BUSINESS_TYPES.map((t) => [t.id, t])
);

/** Returns the definition for a business_type id, or undefined for unknown / null. */
export function getBusinessType(id?: string | null): BusinessTypeDefinition | undefined {
  if (!id) return undefined;
  return BUSINESS_TYPE_BY_ID[id];
}

/** Capabilities for the given business_type. Unknown / null types fall back to BASE_CAPS. */
export function getBusinessCapabilities(id?: string | null): BusinessCapabilities {
  return getBusinessType(id)?.capabilities ?? BASE_CAPS;
}

/** Whether a business type is shown in the picker but not yet usable. */
export function isComingSoonBusinessType(id?: string | null): boolean {
  return !!getBusinessType(id)?.comingSoon;
}

/**
 * Default operation_mode to seed when creating a new outlet for the given
 * business type. Falls back to "standard" for unknown / unselected types.
 */
export function getDefaultOperationMode(id?: string | null): OutletOperationMode {
  return getBusinessType(id)?.defaultOperationMode ?? "standard";
}

/** Live types the picker should let owners actually select. */
export const LIVE_BUSINESS_TYPES = BUSINESS_TYPES.filter((t) => !t.comingSoon);

// ───────────────────────────────────────────────────────────────────────────
// POS order-mode badge
//
// On the New Order screen we render a small chip that tells the cashier what
// flow they're in (Dine In / Takeaway / Self Service / Cloud Kitchen / …).
// The label and icon depend on business_type + operation_mode + orderType,
// so consolidate that logic here to keep the POS components consistent.
// ───────────────────────────────────────────────────────────────────────────

export interface OrderModeBadge {
  label: string;
  icon: LucideIcon;
  /**
   * Visual variant. POS components map this to their own colour scheme.
   *   - "primary" → dine-in (table service)
   *   - "warning" → takeaway / self-service
   *   - "info"    → cloud-kitchen-style delivery
   */
  variant: "primary" | "warning" | "info";
}

export function getOrderModeBadge(
  businessType: string | null | undefined,
  selfService: boolean,
  orderType: "dine_in" | "takeaway"
): OrderModeBadge {
  if (businessType === "cloud_kitchen") {
    return { label: "Cloud Kitchen", icon: Truck, variant: "info" };
  }
  if (selfService) {
    // For other no-table formats (QSR, food cart, sweet shop, bakery) prefer
    // the business-type label over the generic "Self Service".
    const def = getBusinessType(businessType);
    if (def && !def.capabilities.hasTables) {
      return { label: def.label, icon: Store, variant: "warning" };
    }
    return { label: "Self Service", icon: Store, variant: "warning" };
  }
  if (orderType === "dine_in") {
    return { label: "Dine In", icon: Utensils, variant: "primary" };
  }
  return { label: "Takeaway", icon: Package, variant: "warning" };
}
