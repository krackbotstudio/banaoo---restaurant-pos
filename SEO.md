# SEO Implementation Guide

Last updated: **2026-05-26**

This document captures everything that has been wired up for search engine optimisation, what remains to be done, and how to keep things in good shape going forward.

---

## 1. What's been implemented

### 1.1 Per-route SEO with `react-helmet-async`

- Installed `react-helmet-async` and wrapped the app in `<HelmetProvider>` in [`src/App.tsx`](src/App.tsx).
- Created a reusable component at [`src/components/seo/SEO.tsx`](src/components/seo/SEO.tsx) that exposes:
  - `<SEO />` — drops in a per-route `<title>`, meta description, canonical URL, full Open Graph + Twitter card, and optional `noindex`/`keywords`/`article:*` tags.
  - `<StructuredData data={…} />` — emits a JSON-LD `<script>` for any schema.org payload.
  - `buildBreadcrumbList(trail)` — helper for `BreadcrumbList` schema.
  - `buildFaqPage(items)` — helper for `FAQPage` schema.

### 1.2 Public pages wired up

| Page | File | Title | Schema |
|---|---|---|---|
| Home | `src/pages/Landing.tsx` | "banaoo — One App to Run Your Restaurant…" | `FAQPage` (via `buildFaqPage`) |
| About | `src/pages/About.tsx` | "About banaoo" | `BreadcrumbList` |
| Affiliate | `src/pages/Affiliate.tsx` | "Affiliate Program — earn 10% recurring commission" | `BreadcrumbList` + `FAQPage` |
| Docs index | `src/pages/Docs.tsx` | "Documentation" | `BreadcrumbList` |
| Docs article | `src/pages/DocsArticle.tsx` | per article | `BreadcrumbList` + `TechArticle` |
| QR Menu Builder | `src/pages/tools/QRMenuBuilder.tsx` | "Free QR Menu Builder for Restaurants" | `BreadcrumbList` |
| Terms / Privacy / Refund / Shipping | corresponding pages | unique titles | `BreadcrumbList` each |
| Pricing | `src/pages/Pricing.tsx` | "Plans & Pricing" | `noindex` (hidden today) |
| Auth | `src/pages/Auth.tsx` | dynamic | `noindex` |
| Staff PIN login | `src/pages/StaffLogin.tsx` | "Staff PIN Login" | `noindex` |
| 404 | `src/pages/NotFound.tsx` | "Page not found" | `noindex` |

> All authenticated app routes (`/dashboard`, `/orders`, `/admin/*`, `/onboarding`, `/billing/*`, etc.) intentionally do **not** include `<SEO>` — they're behind auth and excluded in `robots.txt`.

### 1.3 Site-wide HTML defaults

[`index.html`](index.html) now contains:

- **Strong default `<title>` and `<meta description>`** — used as a fallback whenever a page hasn't supplied its own (and visible to crawlers that don't run JS).
- **Comprehensive Open Graph block** — `og:site_name`, `og:title`, `og:description`, `og:type`, `og:url`, `og:image` (1200×630), `og:image:width`, `og:image:height`, `og:image:alt`, `og:locale=en_IN`.
- **Full Twitter Card** — `summary_large_image` plus title, description, image and creator handle.
- **Robots/Googlebot directives** — `index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1`.
- **Canonical link** — `https://banaoo.io/` (overridden per page by `<SEO path>`).
- **Performance hints** — `preconnect` to Google Fonts and `dns-prefetch` to Razorpay.
- **`<noscript>` fallback** with the brand pitch and a link to `/docs`, so even JS-disabled users (and naive bots) see useful content.
- **Three site-wide JSON-LD blocks**:
  - **`Organization`** — name, alternate name, logo, areaServed, sameAs (Twitter/LinkedIn/Instagram/YouTube placeholders), contact email. Drives the Knowledge Panel candidacy.
  - **`WebSite` + `SearchAction`** — enables the sitelinks search box on Google.
  - **`SoftwareApplication`** — describes the product to Google.

### 1.4 `sitemap.xml`

- Generated at build time by [`scripts/build-sitemap.mjs`](scripts/build-sitemap.mjs).
- Wired into npm scripts:
  - `npm run sitemap` — regenerate manually.
  - `npm run prebuild` — automatically runs before `npm run build`.
- Currently emits **17 URLs** covering the homepage, About, Affiliate, Docs index, all docs articles, QR Menu Builder, and the four legal pages.
- Each entry has `<lastmod>`, `<changefreq>` and `<priority>`.

### 1.5 `robots.txt`

[`public/robots.txt`](public/robots.txt) now:

- Explicitly **allows** Googlebot, Bingbot, Twitterbot, facebookexternalhit, LinkedInBot, WhatsApp and Slackbot on public marketing pages.
- **Disallows** every authenticated/admin/customer-ordering route so crawl budget isn't wasted: `/dashboard`, `/onboarding`, `/outlets`, `/menu`, `/orders`, `/kitchen`, `/payments`, `/staff`, `/settings`, `/addons`, `/inventory`, `/integrations`, `/order-history`, `/customers`, `/analytics`, `/admin`, `/billing`, `/account-pending`, `/auth`, `/staff-login`, `/affiliate/auth`, `/affiliate/dashboard`, `/affiliate/*`, `/order/`, `/r/`, `/m/`, `/menu/`, `/my-menus`, `/pricing`.
- **Blocks AI training crawlers** that don't drive traffic: `GPTBot`, `CCBot`, `anthropic-ai`, `Google-Extended`. (Adjust if you change your stance on AI training.)
- Includes a **`Sitemap:`** directive pointing at `https://banaoo.io/sitemap.xml`.

### 1.6 Accessibility-friendly typing animations

The Navbar (`banaoo` cycling through 7 scripts) and the Landing hero tagline (`Banaoo!` cycling through scripts) used to expose mid-typing fragments to crawlers and screen readers. Both now use the `sr-only` + `aria-hidden` pattern:

- Canonical brand text in `<span class="sr-only">banaoo</span>` — visible in the DOM and to crawlers, hidden visually.
- Animated decorative span has `aria-hidden="true"` — invisible to assistive tech and Googlebot's accessibility tree.
- The wrapping `<a>` got `aria-label="banaoo home"`; `alt=""` on the logo prevents double announcement.

This means search snippets, link previews and screen reader announcements will consistently say "banaoo" regardless of which animation frame they happen to capture.

### 1.7 OG image placeholder

`public/og-default.png` exists so social-card scrapers (WhatsApp, LinkedIn, Slack, Twitter, Facebook) get a 200 OK response. **It currently contains the small square logo** and should be replaced with a proper 1200×630 design. See **§3.1 Open follow-ups** below.

---

## 2. How to use the SEO component

### 2.1 Standard public page

```tsx
import { SEO, StructuredData, buildBreadcrumbList } from "@/components/seo/SEO";

export default function MyPage() {
  return (
    <>
      <SEO
        title="Page name"
        description="Crisp 130–155 character description with the primary keyword."
        path="/my-page"
      />
      <StructuredData
        data={buildBreadcrumbList([
          { name: "Home", path: "/" },
          { name: "Page name", path: "/my-page" },
        ])}
      />
      {/* your page JSX */}
    </>
  );
}
```

### 2.2 Article-style page (docs/blog)

```tsx
<SEO
  title={article.title}
  description={article.description}
  path={`/docs/${article.slug}`}
  type="article"
  publishedTime={article.lastUpdated}
  modifiedTime={article.lastUpdated}
  author="banaoo"
/>
<StructuredData
  data={{
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: article.title,
    description: article.description,
    datePublished: article.lastUpdated,
    dateModified: article.lastUpdated,
    author: { "@type": "Organization", name: "banaoo", url: "https://banaoo.io" },
    publisher: { /* … */ },
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://banaoo.io/docs/${article.slug}` },
  }}
/>
```

### 2.3 Authenticated/internal page (don't index)

```tsx
<SEO title="Settings" path="/settings" noindex />
```

### 2.4 Homepage-style title (no suffix)

```tsx
<SEO title="banaoo — One App to Run Your Restaurant" disableSuffix description="…" path="/" />
```

### 2.5 Adding a new public page to the sitemap

1. Add the route to `scripts/build-sitemap.mjs` under `STATIC_ROUTES` with appropriate `priority` (1.0 = home, 0.7 = key marketing, 0.3 = legal) and `changefreq`.
2. Run `npm run sitemap` to regenerate locally, or just `npm run build` (which runs prebuild).
3. Submit the updated sitemap in Google Search Console.

### 2.6 Adding a new doc article

1. Add the markdown to `src/content/docs/articles/` and register it in `src/content/docs/registry.ts`.
2. Mirror the entry in `scripts/build-sitemap.mjs` under `getDocRoutes()`. (TODO: switch to importing the registry directly.)
3. The page automatically gets `Article` and `BreadcrumbList` schema via `DocsArticle.tsx`.

---

## 3. Open follow-ups

### 3.1 Required next actions (you, not code)

- [ ] **Replace `public/og-default.png`** with a proper **1200×630 PNG** — banaoo logo + tagline ("One App to Run Your Restaurant") on the warm gradient. This is what shows on every WhatsApp / Slack / LinkedIn / Twitter share. Until replaced, link previews will show a small logo cropped into the 1200×630 frame.
- [ ] **Verify domain ownership in Google Search Console** (`search.google.com/search-console`). Use the **DNS TXT** verification method (most robust). Once verified, submit `https://banaoo.io/sitemap.xml` and start monitoring Coverage / Performance / Enhancements reports daily for the first month.
- [ ] **Verify domain in Bing Webmaster Tools** (`bing.com/webmasters`). Mirror the Google setup — about 25% of Indian search traffic still goes through Bing/DuckDuckGo/ChatGPT-Search, all of which use Bing's index.
- [ ] **Update social `sameAs` URLs** in [`index.html`](index.html) — currently lists placeholders (`twitter.com/banaoo_io`, `linkedin.com/company/banaoo`, etc.). Replace any that don't exist yet, and add more once you create them. Empty/404 `sameAs` URLs hurt rather than help.
- [ ] **Set up a Google Business Profile** (`business.google.com`). The right-side knowledge panel in the ElevenLabs example draws from this. Postcard verification takes ~5 days.
- [ ] **Submit a Wikidata entry** for banaoo (`wikidata.org`) once the basics are above. Lists founding date, headquarters, founder(s), product category, social profiles. This is what lets Google Knowledge Graph understand your brand in absence of a Wikipedia article.

### 3.2 Pre-rendering (recommended next code task)

Today the site is **pure CSR** — Googlebot will execute the JS and see the per-route `<title>` set by `react-helmet-async`, but **other crawlers won't**. WhatsApp, LinkedIn, Slack, Twitter, Bingbot and most AI scrapers fetch the static HTML and never run scripts. They currently see the *default* `index.html` head (homepage title) regardless of which URL they're scraping.

**Recommended fix:** add a build-time prerender step.

Two options, lowest effort first:

1. **`vite-prerender-plugin`** — list routes in `vite.config.ts`, the plugin spins up a headless Chrome at build time and writes `dist/<route>/index.html` with fully-rendered HTML for each. Existing CSR for authenticated routes is unchanged. ~30 min to wire up.
2. **Migrate marketing surfaces to Astro** — keeps `Landing.tsx` as a React island, gets static HTML + lightning LCP. Bigger lift but the better long-term move.

Until prerender is in place, **link previews on `/about`, `/docs/*`, `/affiliate`, etc. will fall back to the homepage OG tags**. The good news is Google itself runs JS, so search rankings are not affected.

### 3.3 Performance / Core Web Vitals

- **Compress hero videos.** [`public/hero-loop.mp4`](public/hero-loop.mp4) is 2.4 MB and `hero-orders.mp4` is 2.2 MB. Both autoplay. Run them through `ffmpeg -crf 28 -preset slower -movflags +faststart` to halve the size, and add a small **poster image** so first paint shows the still instantly.
- **Modern image formats.** Convert PNG/JPEG hero/marketing images to AVIF + WebP (with fallbacks). Use `<picture>` for legacy browsers.
- **Width/height on every `<img>`.** Prevents Cumulative Layout Shift, which is a ranking signal.
- **Lazy-load below-the-fold images.** Most are already in the wild; verify with Lighthouse.

### 3.4 Content / authority (long term)

- **Blog under `/docs` or `/blog`.** Target high-volume, low-competition queries: "Best restaurant POS in India 2026", "How to start a cloud kitchen in Bengaluru", "GST for restaurants: complete guide", "Restaurant inventory management 101". Each post gets `Article` schema (already supported).
- **Backlinks.** Get listed on G2, Capterra, GetApp, SoftwareSuggest, YourStory, Inc42, Entrackr. Submit a launch on Product Hunt. These are the easiest authoritative inbound links for B2B SaaS in India.
- **Press releases** (PRNewswire India / BusinessWire India) when you hit milestones — funding, customer counts, product launches.
- **Real customer case studies** as separate pages with `Review` / `Article` schema and the customer logo. These rank surprisingly well for "<cuisine> POS <city>" queries.

### 3.5 Operational hygiene

- **Pick a canonical hostname** — `banaoo.io` (apex) or `www.banaoo.io`. Configure your hosting / DNS to **301 redirect** the other variant. Keep the chosen one as the only `<link rel=canonical>` value.
- **Force HTTPS** + add **HSTS** (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`) once you're certain the cert chain is solid.
- **Trailing-slash policy.** Decide whether `/about` or `/about/` is canonical, and 301 the other.
- **Monitor in Search Console weekly** for the first 3 months. Most issues surface there before users notice.

### 3.6 Stop-the-press conditions

If you ever see any of these in Search Console, treat as P0:

- "Indexed, though blocked by robots.txt" on a public page → robots.txt accidentally blocks something it shouldn't.
- Coverage drops > 20% week-over-week → something pushed broke crawlability.
- "Soft 404" on the homepage → SPA fallback isn't returning real content.
- Mobile usability errors → CSS regression broke responsive layout.

---

## 4. What unlocks the "ElevenLabs-style" SERP

For reference, the screenshot of ElevenLabs that prompted this work shows: brand title, verified checkmark, multi-line description, **6 sitelinks** (Text to Speech / Pricing / Free Hindi TTS / Voice Cloning / Sign Up / Sign In), a knowledge panel sidebar, and "People also search for" carousel.

| Feature | What produces it | Status for banaoo |
|---|---|---|
| Brand title + clean URL | Strong `<title>` + canonical + brand consistency | ✅ Implemented |
| Verified checkmark | `Organization` JSON-LD + Search Console verification + Wikidata + brand presence | ⚠️ JSON-LD ready; Search Console + Wikidata pending |
| Quality multi-line description | Wikipedia article OR strong, consistent meta descriptions | ⚠️ Long-term — needs Wikipedia or sustained brand SEO |
| **Sitelinks** | Rank #1 for the brand name + crawlable internal pages with strong unique titles + clear nav + sitemap + `BreadcrumbList` | ✅ Foundation in place — sitelinks emerge after Search Console indexing matures (4–8 weeks) |
| Knowledge panel sidebar | Wikidata + Wikipedia + Google Business Profile + Organization JSON-LD | ⚠️ JSON-LD ready; the rest are external setup tasks |
| "People also search for" | Pure Google co-occurrence — comes with brand authority over time | ⏳ Naturally over months |
| "Date founded" / "Headquarters" infobox | Wikipedia infobox + Wikidata | ⏳ Wikidata first, Wikipedia later (notability requirement) |

The realistic milestone is **rich sitelinks within 4–8 weeks of Tier 1 + Tier 2 going live**, **knowledge panel ~3–6 months in** (gated on Wikidata + Google Business Profile), and **a "People also search for" carousel ~6+ months in** (gated on brand search volume).

---

## 5. File index

Files created or changed for this work:

```
index.html                                     → expanded head, JSON-LD, <noscript>
public/robots.txt                              → full directive set + sitemap
public/sitemap.xml                             → generated, 17 URLs
public/og-default.png                          → placeholder OG image (replace!)
package.json                                   → added prebuild/sitemap scripts + react-helmet-async
scripts/build-sitemap.mjs                      → sitemap generator
src/App.tsx                                    → wrapped in HelmetProvider
src/components/seo/SEO.tsx                     → SEO + StructuredData components + helpers
src/components/landing/Navbar.tsx              → typing-animation a11y/SEO fix
src/pages/Landing.tsx                          → SEO + FAQPage + typing-animation a11y/SEO fix
src/pages/About.tsx                            → SEO + breadcrumb
src/pages/Pricing.tsx                          → SEO (noindex)
src/pages/Terms.tsx                            → SEO + breadcrumb
src/pages/Privacy.tsx                          → SEO + breadcrumb
src/pages/Refund.tsx                           → SEO + breadcrumb
src/pages/Shipping.tsx                         → SEO + breadcrumb
src/pages/Docs.tsx                             → SEO + breadcrumb
src/pages/DocsArticle.tsx                      → SEO + breadcrumb + TechArticle schema
src/pages/Affiliate.tsx                        → SEO + breadcrumb + FAQPage
src/pages/Auth.tsx                             → SEO (noindex)
src/pages/StaffLogin.tsx                       → SEO (noindex)
src/pages/NotFound.tsx                         → SEO (noindex)
src/pages/tools/QRMenuBuilder.tsx              → SEO + breadcrumb + keywords
SEO.md                                         → this document
```

---

## 6. Quick start checklist for a new contributor

When adding a new public page, do all of:

1. ✅ Add `<SEO title="…" description="…" path="/foo" />` at the top of the JSX.
2. ✅ Add a `<StructuredData data={buildBreadcrumbList([...])} />` if the page is nested.
3. ✅ Append the route to `STATIC_ROUTES` in `scripts/build-sitemap.mjs`.
4. ✅ Run `npm run sitemap` to verify it shows up.
5. ✅ Run `npx tsc --noEmit` to make sure TypeScript is happy.
6. ✅ Spot-check by running `npm run dev` and inspecting `<head>` in DevTools on the new route — you should see your custom title and description.

For private/authenticated pages, the simpler form `<SEO title="…" path="/foo" noindex />` is enough.
