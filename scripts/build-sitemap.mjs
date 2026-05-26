// Generates public/sitemap.xml from a static list of public routes.
// Run before `vite build` (wired via the `prebuild` npm script).
//
// To add a new public URL, append it below. Anything served behind /dashboard,
// /admin, /onboarding, /billing, /auth, /staff-login, etc. is intentionally
// excluded — those are application routes, not crawlable marketing pages.

import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITE_URL = process.env.SITE_URL || "https://banaoo.io";
const PUBLIC_DIR = resolve(__dirname, "..", "public");
const TODAY = new Date().toISOString().split("T")[0];

// ─── Static public routes ────────────────────────────────────────────────────

const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changefreq: "weekly" },
  { path: "/about", priority: 0.7, changefreq: "monthly" },
  { path: "/affiliate", priority: 0.7, changefreq: "monthly" },
  { path: "/docs", priority: 0.8, changefreq: "weekly" },
  { path: "/tools/qr-menu-builder", priority: 0.7, changefreq: "monthly" },
  { path: "/terms", priority: 0.3, changefreq: "yearly" },
  { path: "/privacy", priority: 0.3, changefreq: "yearly" },
  { path: "/refund", priority: 0.3, changefreq: "yearly" },
  { path: "/shipping", priority: 0.3, changefreq: "yearly" },
];

// ─── Doc articles (resolved at build time from the static registry) ──────────

async function getDocRoutes() {
  // The registry is authored as TypeScript; rather than transpile it, we mirror
  // the article list here. Keep this in sync with src/content/docs/registry.ts.
  // (If this list grows, switch to importing the registry via tsx/ts-node.)
  const articles = [
    { slug: "getting-started", lastUpdated: "2026-05-20" },
    { slug: "outlets-and-menu", lastUpdated: "2026-05-21" },
    { slug: "orders-and-pos", lastUpdated: "2026-05-20" },
    { slug: "kitchen", lastUpdated: "2026-05-15" },
    { slug: "billing-and-receipts", lastUpdated: "2026-05-15" },
    { slug: "printers", lastUpdated: "2026-05-15" },
    { slug: "mobile-app", lastUpdated: "2026-05-22" },
    { slug: "faq-troubleshooting", lastUpdated: "2026-05-15" },
  ];
  return articles.map((a) => ({
    path: `/docs/${a.slug}`,
    priority: 0.6,
    changefreq: "monthly",
    lastmod: a.lastUpdated,
  }));
}

// ─── XML builders ────────────────────────────────────────────────────────────

function urlEntry({ path, priority, changefreq, lastmod = TODAY }) {
  return [
    "  <url>",
    `    <loc>${SITE_URL}${path}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority.toFixed(1)}</priority>`,
    "  </url>",
  ].join("\n");
}

function buildSitemap(routes) {
  const body = routes.map(urlEntry).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n");
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const docRoutes = await getDocRoutes();
  const all = [...STATIC_ROUTES, ...docRoutes];
  const xml = buildSitemap(all);

  await mkdir(PUBLIC_DIR, { recursive: true });
  const outPath = resolve(PUBLIC_DIR, "sitemap.xml");
  await writeFile(outPath, xml, "utf8");

  console.log(
    `[sitemap] wrote ${all.length} URLs to ${outPath} (base ${SITE_URL})`
  );
}

main().catch((err) => {
  console.error("[sitemap] failed:", err);
  process.exit(1);
});
