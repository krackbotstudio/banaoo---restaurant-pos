/**
 * Public documentation manifest.
 * When you change a product feature, update the matching article under articles/
 * and bump lastUpdated for that entry.
 */

export type DocSectionId =
  | "start"
  | "operations"
  | "hardware"
  | "help";

export interface DocArticleMeta {
  slug: string;
  title: string;
  description: string;
  section: DocSectionId;
  sectionTitle: string;
  lastUpdated: string;
  /** Maps to articles/{slug}.md */
  file: string;
}

export const DOC_SECTIONS: { id: DocSectionId; title: string }[] = [
  { id: "start", title: "Getting started" },
  { id: "operations", title: "Daily operations" },
  { id: "hardware", title: "Hardware & mobile" },
  { id: "help", title: "Help" },
];

export const DOC_ARTICLES: DocArticleMeta[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    description: "Create your account, add outlets, build your menu, and invite staff.",
    section: "start",
    sectionTitle: "Getting started",
    lastUpdated: "2026-07-21",
    file: "getting-started",
  },
  {
    slug: "outlets-and-menu",
    title: "Outlets & menu",
    description: "Multi-outlet setup, ordering links per outlet, categories, items, and QR menus.",
    section: "start",
    sectionTitle: "Getting started",
    lastUpdated: "2026-05-28",
    file: "outlets-and-menu",
  },
  {
    slug: "orders-and-pos",
    title: "Orders & POS",
    description: "Dine-in, takeaway, delivery, counter mode, discounts, and order flow.",
    section: "operations",
    sectionTitle: "Daily operations",
    lastUpdated: "2026-07-21",
    file: "orders-and-pos",
  },
  {
    slug: "shiprocket-delivery",
    title: "Shiprocket delivery",
    description: "Connect Shiprocket, auto-book riders, track deliveries, and troubleshoot booking.",
    section: "operations",
    sectionTitle: "Daily operations",
    lastUpdated: "2026-05-28",
    file: "shiprocket-delivery",
  },
  {
    slug: "kitchen",
    title: "Kitchen display",
    description: "Kitchen screen, order sounds, statuses, and printing from kitchen.",
    section: "operations",
    sectionTitle: "Daily operations",
    lastUpdated: "2026-05-20",
    file: "kitchen",
  },
  {
    slug: "billing-and-receipts",
    title: "Billing & receipts",
    description: "Bills, GST, service charge, reprints, and customer copies.",
    section: "operations",
    sectionTitle: "Daily operations",
    lastUpdated: "2026-05-20",
    file: "billing-and-receipts",
  },
  {
    slug: "printers",
    title: "Printers",
    description: "Printer fleet, Bluetooth/LAN, native Android app, and test prints.",
    section: "hardware",
    sectionTitle: "Hardware & mobile",
    lastUpdated: "2026-05-20",
    file: "printers",
  },
  {
    slug: "mobile-app",
    title: "Mobile app (Android)",
    description: "Install the Banaoo APK, permissions, and using POS in the app.",
    section: "hardware",
    sectionTitle: "Hardware & mobile",
    lastUpdated: "2026-05-20",
    file: "mobile-app",
  },
  {
    slug: "faq-troubleshooting",
    title: "FAQ & troubleshooting",
    description: "Common issues, print failures, login, and support contact.",
    section: "help",
    sectionTitle: "Help",
    lastUpdated: "2026-07-21",
    file: "faq-troubleshooting",
  },
];

const articleModules = import.meta.glob("./articles/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const slugToPath = (slug: string) => `./articles/${slug}.md`;

export function getDocArticle(slug: string): (DocArticleMeta & { body: string }) | null {
  const meta = DOC_ARTICLES.find((a) => a.slug === slug);
  if (!meta) return null;
  const body = articleModules[slugToPath(meta.file)];
  if (!body) return null;
  return { ...meta, body: stripDuplicateTitle(body) };
}

/** Page layout already shows the article title; drop redundant leading H1 from markdown. */
function stripDuplicateTitle(md: string): string {
  return md.replace(/^#\s+[^\n]+\n+/, "");
}

export function getDocArticlesBySection(section: DocSectionId): DocArticleMeta[] {
  return DOC_ARTICLES.filter((a) => a.section === section);
}

export function formatDocDate(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}
