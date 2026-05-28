export type ProductUpdateTag = "new" | "improved" | "fix";

export interface ProductUpdate {
  id: string;
  title: string;
  summary: string;
  date: string;
  tag: ProductUpdateTag;
  href?: string;
}

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "visual-orders",
    title: "Visual floor plan for orders",
    summary:
      "See dine-in tables, takeaway bags, and online boxes at a glance. Tap a spot to start or manage orders without leaving the floor view.",
    date: "2026-05-27",
    tag: "new",
    href: "/docs/orders-and-pos",
  },
  {
    id: "inline-pos",
    title: "Inline ordering from the floor",
    summary:
      "Start new orders and add items directly from the visual view — no redirect to a separate screen during service.",
    date: "2026-05-27",
    tag: "new",
  },
  {
    id: "notification-panel",
    title: "Sticky notification panel",
    summary:
      "Alerts now live in a collapsible panel on the right so you can review updates without blocking the POS.",
    date: "2026-05-26",
    tag: "improved",
  },
  {
    id: "orders-toolbar",
    title: "Cleaner orders filters",
    summary:
      "Filter by date, source, and status with dropdowns and sorting — easier to find the order you need during rush hour.",
    date: "2026-05-25",
    tag: "improved",
    href: "/docs/orders-and-pos",
  },
  {
    id: "app-tour",
    title: "Interactive app tour",
    summary:
      "New walkthroughs by module help your team learn the POS hands-on. Open anytime from the info icon in the top bar.",
    date: "2026-05-27",
    tag: "new",
  },
];
