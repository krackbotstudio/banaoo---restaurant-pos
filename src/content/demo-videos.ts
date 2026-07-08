/**
 * Onboarding demo videos — Google Drive folder:
 * https://drive.google.com/drive/folders/19gv88d06Y0HxfMR1sWhY80LwUpb0i6UL
 *
 * Re-sync IDs: curl folder HTML → node scripts/parse-drive-folder.mjs
 */

export const DEMO_VIDEOS_FOLDER_ID = "19gv88d06Y0HxfMR1sWhY80LwUpb0i6UL";

export const DEMO_VIDEOS_FOLDER_URL =
  "https://drive.google.com/drive/folders/19gv88d06Y0HxfMR1sWhY80LwUpb0i6UL?usp=sharing";

export interface DemoVideo {
  id: string;
  driveFileId: string;
  title: string;
  description: string;
  category: "getting-started" | "outlets" | "operations" | "menu" | "orders" | "staff" | "analytics";
}

/** Google Drive embed player (shared files must allow anyone with link). */
export function driveEmbedUrl(fileId: string, autoplay = false): string {
  const q = autoplay ? "?autoplay=1" : "";
  return `https://drive.google.com/file/d/${fileId}/preview${q}`;
}

/** Thumbnail for video cards (works for publicly shared Drive files). */
export function driveThumbnailUrl(fileId: string): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w640`;
}

export const DEMO_VIDEOS: DemoVideo[] = [
  {
    id: "create-account",
    driveFileId: "1tRfNknKxiB2WYYTk8BcqxGw6nYmlTeha",
    title: "How to create a Banaoo account",
    description: "Sign up and set up your restaurant owner account.",
    category: "getting-started",
  },
  {
    id: "owner-sign-in",
    driveFileId: "1TBTr66bbn2KO1cPOkH8PDECq01A4lKoA",
    title: "How to sign in as restaurant owner",
    description: "Log in to your Banaoo dashboard as the owner.",
    category: "getting-started",
  },
  {
    id: "onboarding",
    driveFileId: "1IyFoG9qFI95WYBTDE-QNFsgJYPqToEUI",
    title: "How to complete onboarding",
    description: "Finish the initial setup wizard after signup.",
    category: "getting-started",
  },
  {
    id: "manage-outlets",
    driveFileId: "1KW2RX7Ri5E52wXvDZrQaLIMWDEYB4ULZ",
    title: "Configure and manage outlets",
    description: "Create and configure restaurant outlets on the platform.",
    category: "outlets",
  },
  {
    id: "outlet-settings",
    driveFileId: "16Wz26KH6oXVxjFy1EUW7efJHjnOYPJng",
    title: "Configure outlet settings",
    description: "Outlet-level settings in the Banaoo restaurant app.",
    category: "outlets",
  },
  {
    id: "restaurant-outlet-settings",
    driveFileId: "18QLqU0XaFq38hWHT3r7P48YCh2wtyb9Q",
    title: "Restaurant outlet settings",
    description: "Detailed outlet configuration options.",
    category: "outlets",
  },
  {
    id: "delete-outlets",
    driveFileId: "1QznfUGaT33ykesvAA2Zu_41-ms504qGh",
    title: "Manage and delete outlets",
    description: "Edit or remove outlets when needed.",
    category: "outlets",
  },
  {
    id: "manage-outlet-settings",
    driveFileId: "1JqEkoUmTNHkKDQOhmPPWCaJrPraLYB3x",
    title: "Manage restaurant outlet settings",
    description: "Day-to-day outlet settings management.",
    category: "outlets",
  },
  {
    id: "scheduling-promotions",
    driveFileId: "1ErzXaS8jD4ZGkjnKVlIvNWMfPlYzh1Bt",
    title: "Scheduling and promotions",
    description: "Configure hours, scheduling, and promotions.",
    category: "operations",
  },
  {
    id: "branding-orders",
    driveFileId: "1WZQqLjiJVDJ4jvc7Z3tTwBTxdrpsrX56",
    title: "Branding and orders",
    description: "Customize branding and manage orders from settings.",
    category: "operations",
  },
  {
    id: "menu-management",
    driveFileId: "1HokAt3jI1vxOCOGjBkrO5vvksJY-v2IA",
    title: "Menu management",
    description: "Add categories, items, and manage your menu.",
    category: "menu",
  },
  {
    id: "ai-import",
    driveFileId: "1I_c0ChpX5fpnIIb7M_xbVWcTys7oHszH",
    title: "AI menu import",
    description: "Import your menu quickly with the AI import feature.",
    category: "menu",
  },
  {
    id: "order-management",
    driveFileId: "1fa4wLv1dRbmzIHsvWhUdahpPioWY0vJC",
    title: "Order management",
    description: "Take orders, update status, and run the POS flow.",
    category: "orders",
  },
  {
    id: "order-management-2",
    driveFileId: "1U4GiHzw0ltO7OvnX2KB9-tnpXQL9SWH7",
    title: "Order management (advanced)",
    description: "More order workflows and POS features.",
    category: "orders",
  },
  {
    id: "streamline-orders",
    driveFileId: "1o-YmXA6aF8RI8DzocCxkw2GZlbTP1IJB",
    title: "Streamline order management",
    description: "Tips to run orders faster during service.",
    category: "orders",
  },
  {
    id: "staff-login",
    driveFileId: "1Jr3VUrfPDyrmAiWpONMAmAbAT-uoJULF",
    title: "Staff login workflow",
    description: "How staff sign in and use the app.",
    category: "staff",
  },
  {
    id: "staff-members",
    driveFileId: "1uZ5j8HE-adDMc8linSIObFRsNQ1BAzrN",
    title: "Manage staff members",
    description: "Add, edit, and manage your team.",
    category: "staff",
  },
  {
    id: "analytics-inventory",
    driveFileId: "1k0dX3lgHEGHku7ChyKVtiw4w9ZzzFbhN",
    title: "Analytics and inventory",
    description: "Explore reports and manage inventory.",
    category: "analytics",
  },
];
