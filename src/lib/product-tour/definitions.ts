import type { TourModule, TourModuleId } from "./types";

export const TOUR_MODULES: Record<TourModuleId, TourModule> = {
  overview: {
    id: "overview",
    title: "Full app overview",
    description: "A quick pass through navigation and the main areas of Banaoo.",
    route: "/dashboard",
    estimatedMinutes: 4,
    steps: [
      {
        element: '[data-tour="nav-dashboard"]',
        title: "Navigation sidebar",
        description:
          "Use the sidebar to jump between Dashboard, Menu, Orders, Kitchen, and more. Items you see depend on your role.",
        side: "right",
      },
      {
        element: '[data-tour="dashboard-stats"]',
        title: "Today's snapshot",
        description:
          "Track orders, revenue, and covers at a glance. Stats refresh for your currently selected outlet.",
        side: "bottom",
      },
      {
        element: '[data-tour="tour-info-button"]',
        title: "Help anytime",
        description:
          "Tap this info icon whenever you want a guided walkthrough of a specific module.",
        side: "bottom",
      },
    ],
  },
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    description: "Learn how to read insights and use quick actions.",
    route: "/dashboard",
    permission: "dashboard",
    estimatedMinutes: 2,
    steps: [
      {
        element: '[data-tour="dashboard-welcome"]',
        title: "Your home base",
        description:
          "The dashboard greets you with today's context for your restaurant brand and outlet.",
        side: "bottom",
      },
      {
        element: '[data-tour="dashboard-stats"]',
        title: "Key metrics",
        description:
          "Orders, revenue, covers, and outlets — updated live from today's service.",
        side: "bottom",
      },
      {
        element: '[data-tour="dashboard-insight"]',
        title: "AI insights",
        description:
          "Smart suggestions based on your setup — empty menu, pending kitchen orders, or next best action.",
        side: "top",
      },
      {
        element: '[data-tour="dashboard-actions"]',
        title: "Quick actions",
        description:
          "One-click shortcuts to New Order, Kitchen, Menu, and Outlets for faster service.",
        side: "top",
      },
      {
        element: '[data-tour="dashboard-resources"]',
        title: "Guides & resources",
        description:
          "Helpful articles for setup and daily operations. Open full docs anytime for deeper reading.",
        side: "top",
      },
    ],
  },
  orders: {
    id: "orders",
    title: "Orders & visual floor",
    description: "Take and manage orders with the visual floor plan.",
    route: "/orders",
    permission: "orders",
    estimatedMinutes: 3,
    steps: [
      {
        element: '[data-tour="orders-header"]',
        title: "Orders hub",
        description:
          "All live and recent orders for your outlet. Switch between visual floor and list views.",
        side: "bottom",
      },
      {
        element: '[data-tour="orders-view-toggle"]',
        title: "Visual vs list",
        description:
          "Visual mode shows tables, takeaway bags, and online boxes. List mode is great for search and bulk review.",
        side: "bottom",
      },
      {
        element: '[data-tour="orders-filters"]',
        title: "Filters & sorting",
        description:
          "Narrow by date, source, status, or sort by total — find the order you need during rush hour.",
        side: "bottom",
      },
      {
        element: '[data-tour="orders-visual-hub"]',
        title: "Interactive floor",
        description:
          "Tap a table or spot to view the active order, add items, print a bill, or start a new order — all inline.",
        side: "top",
      },
    ],
  },
  menu: {
    id: "menu",
    title: "Menu management",
    description: "Categories, items, pricing, and AI import.",
    route: "/menu",
    permission: "menu",
    estimatedMinutes: 2,
    steps: [
      {
        element: '[data-tour="menu-header"]',
        title: "Your menu",
        description:
          "Build categories and items here. Use AI Import to scan a physical menu and extract items automatically.",
        side: "bottom",
      },
      {
        element: '[data-tour="nav-menu"]',
        title: "Always in reach",
        description: "Menu is one tap away in the sidebar whenever you need to update availability or pricing.",
        side: "right",
      },
    ],
  },
  kitchen: {
    id: "kitchen",
    title: "Kitchen display",
    description: "Live order queue for the back of house.",
    route: "/kitchen",
    permission: "kitchen",
    estimatedMinutes: 2,
    steps: [
      {
        element: '[data-tour="kitchen-header"]',
        title: "Kitchen queue",
        description:
          "Incoming orders appear here in real time. Tap to advance status when dishes are ready.",
        side: "bottom",
      },
      {
        element: '[data-tour="nav-kitchen"]',
        title: "Quick access",
        description: "Kitchen staff can pin this screen on a tablet — also reachable from the top bar on desktop.",
        side: "right",
      },
    ],
  },
};

export const TOUR_MODULE_LIST: TourModule[] = Object.values(TOUR_MODULES);

export function getAvailableModules(
  isOwner: boolean,
  permissions: string[] | null | undefined
): TourModule[] {
  return TOUR_MODULE_LIST.filter((mod) => {
    if (!mod.permission) return true;
    if (isOwner || permissions === null) return true;
    if (!Array.isArray(permissions)) return false;
    return permissions.includes(mod.permission);
  });
}
