# Tech Stack

A high-level inventory of every technology used across the banaoo platform — web app, backend service, mobile shell, and the data layer. **Use this file to get oriented before diving into [`frontend.md`](frontend.md), [`backend.md`](backend.md), [`mobile-app.md`](mobile-app.md), and [`api.md`](api.md).**

> Versions listed here come from `package.json` files in the repo at the time of writing. Always treat the lock files as the source of truth.

---

## 1. Languages & runtimes

| Where | Language | Notes |
|---|---|---|
| Web app | TypeScript 5.8 (strict off, `strictNullChecks` off) | Pragmatic config — JSX is `react-jsx`, target `ES2020`, `moduleResolution: "bundler"`. |
| Backend | Node.js (LTS) + JavaScript (ESM) | `"type": "module"` in `server/package.json`; Dockerfile pins `node:20-alpine`. |
| Mobile | TypeScript 5.9 + JavaScript (Expo) | `react` 19.1.0, `react-native` 0.81.5. |
| Edge functions | Deno (TypeScript) | Standard Supabase Edge Function runtime. |
| Database | PostgreSQL (Supabase) + plpgsql | Schema lives in `supabase/migrations/`. |
| Build scripts | Node.js ESM (`*.mjs`) | Sitemap generator, etc. |
| Windows dev tooling | PowerShell | Mobile build/release scripts under `mobile/scripts/*.ps1`. |

---

## 2. Web app (`src/`)

### Framework

- **React 18.3** with `react-dom` and `react-router-dom` 6.30 (BrowserRouter, lazy + `<Suspense>` for code-splitting).
- **Vite 5** as the dev server and bundler.
- **`@vitejs/plugin-react-swc`** for fast refresh.

### Styling & UI

- **Tailwind CSS 3.4** (`darkMode: ["class"]`, `class` strategy on `<html>`).
- **shadcn/ui** as the component baseline — see every file under `src/components/ui/`. Configured by `components.json` (style `default`, base color `slate`, `cssVariables: true`).
- **Radix Primitives** (`@radix-ui/react-*`) provide unstyled accessibility behavior for every interactive UI primitive.
- **`tailwindcss-animate`** and **`@tailwindcss/typography`** plugins (typography is used by the docs reader).
- **DM Sans** (Google Fonts, preloaded in `index.html`).
- **`lucide-react`** for icons (~0.462.0).
- **`sonner`** + Radix toaster — two coexisting toast systems (sonner is the default for backend errors).

### State & data

- **TanStack Query 5** (`@tanstack/react-query`) — one shared `QueryClient` (defaults; no global overrides). Currently used most heavily by `useprintfleet`.
- **React Context** for cross-cutting concerns: `AuthProvider`, `OutletProvider`, `ThemeProvider`, `CartProvider`, `CustomerProvider`, `HelmetProvider`, `TooltipProvider`.
- **`react-hook-form` + `zod` + `@hookform/resolvers`** for forms with schema validation.
- **`@supabase/supabase-js` 2.x** — used for live data (RLS-aware), gated by a JWT minted by the Express backend.

### Specialty libraries

- **`recharts`** — analytics charts.
- **`leaflet` + `react-leaflet`** — outlet map view in the customer ordering app.
- **`qrcode.react`** — QR code generation (QR menus + customer ordering URLs).
- **`lz-string`** — used to compress menus encoded in the URL (`/m/:menuData`).
- **`react-markdown` + `remark-gfm`** — in-app docs rendering.
- **`embla-carousel-react`**, **`react-day-picker`**, **`vaul`** (drawer), **`input-otp`**, **`react-resizable-panels`**, **`cmdk`** (command palette) — UI helpers.
- **`react-helmet-async` 3** — SEO; wraps `<head>` writes per route.
- **`next-themes`** — bridges system theme detection (the actual theme state lives in `ThemeProvider`).
- **`class-variance-authority` + `clsx` + `tailwind-merge`** — utility for variant-driven class composition.

### Build / tooling

- **ESLint 9** with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh` — flat config (`eslint.config.js`).
- **PostCSS + Autoprefixer**.
- **`vite.config.ts`** — proxy rules (`/api` → `localhost:5001`, `/auth` with bypass), manual vendor chunks.

---

## 3. Backend service (`server/`)

| Concern | Library | Notes |
|---|---|---|
| HTTP | `express` 4.21 | ESM (`"type": "module"`). |
| Sessions | `express-session` + `connect-pg-simple` 9 | Pool-backed session store in Postgres `public.session` table. |
| Auth | `passport` 0.7 + `passport-local` + `passport-google-oauth20` | Email/password + staff PIN + Google OAuth. |
| Password hashing | `bcryptjs` 2.4 | Salt rounds = 10. |
| JWT minting | `jsonwebtoken` 9 | Supabase HS256 JWTs (24h) for browser RLS; billing-link short-lived JWTs (15 min). |
| Database driver | `pg` 8.13 | Single shared `pg.Pool`, SSL auto-detect. |
| File uploads | `multer` 2.1 | Disk storage in `./uploads`, 5 MB max. |
| Cookies | `cookie-parser` 1.4 |  |
| CORS | `cors` 2.8 | Dynamic allowlist combining `FRONTEND_URL` env + localhost ports. |
| Env loading | `dotenv` 16.4 | Loaded once in `server/index.js` and `server/db.js`. |
| Email | `@getbrevo/brevo` 5 | Used by `server/email.js` (subscription confirmation). |
| Dev runtime | `nodemon` 3.1 | `npm run dev`. |

**External services called via raw `fetch` (no SDK):**

- **Razorpay** (Orders API) — Basic-auth with `RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET`.
- **OpenAI** (`gpt-4o` for menu OCR, `gpt-4o-mini` for voice orders + support chat SSE).
- **Pexels**, **TheMealDB**, **Wikipedia REST** — image fallbacks for menu generation.
- **Google Identity** via Passport's `passport-google-oauth20`.

---

## 4. Mobile shell (`mobile/`)

| Concern | Library | Notes |
|---|---|---|
| Framework | Expo 54 + React Native 0.81.5 + React 19.1 | New Architecture enabled (`newArchEnabled: true` in `app.json`). |
| Bundle ID | `com.banaoo` (Android + iOS) | Slug `banaoo-pos-mobile`, scheme `banaoo://`. |
| Current version | 0.0.18 / `versionCode` 20 |  |
| WebView | `react-native-webview` 13.15 | Loads `https://banaoo.in/auth` as a near-pure shell. |
| Storage | `@react-native-async-storage/async-storage` 2.2 |  |
| Navigation | `@react-navigation/native` 7.2 + `native-stack` 7.14 | Bottom-tabs dep is installed but unused. |
| Splash | `expo-splash-screen` 31 | Manual prevent + hide on WebView load. |
| Deep linking | `expo-linking` 8 |  |
| External browser | `expo-web-browser` 15 | Mobile billing handoff. |
| OTA | `expo-updates` 29 | `ON_ERROR_RECOVERY` policy, `runtimeVersion.policy = "appVersion"`. |
| Bluetooth (BLE) | `react-native-ble-plx` 3.5 | Modern BLE printers. |
| Bluetooth (Classic SPP) | `react-native-bluetooth-classic` 1.73-rc | Legacy thermal printers. |
| Network printers | `react-native-tcp-socket` 6.2 | Raw IP:9100 ESC/POS. |
| Image generation | `sharp` 0.34 | Used in `scripts/build-adaptive-assets.cjs` to produce adaptive icon + splash. |

**Native plugins (Expo config plugins) in `mobile/plugins/`:**

- `with-screen-orientation.js`
- `with-android-release.js` (Gradle release tweaks, BouncyCastle dedupe)

**Build pipeline:**

- **EAS Build** — `preview` profile produces APKs (internal distribution), `production` profile produces AABs.
- **EAS Submit** — uploads to the Play Console `internal` track (`releaseStatus: draft`) using `mobile/play-store/service-account.json`.
- **Local Gradle release** scripts (`mobile/scripts/build-release-*.ps1`) — uses a `D:\_bnmob` junction to dodge Windows `MAX_PATH`; output is **debug-signed**, sideload only.

---

## 5. Data layer (Supabase)

| Concern | Where | Notes |
|---|---|---|
| Database | Supabase Postgres | Schema lives in `supabase/migrations/*.sql`. |
| Auth | **Custom Express auth, not Supabase Auth.** | Supabase RLS still applies, satisfied by a JWT minted via `/auth/supabase-token`. |
| RLS | `supabase/migrations/*` | Every public table has policies; Cloud-kitchen `enforce_cloud_kitchen_self_service()` trigger silently rewrites `operation_mode`. |
| Edge functions | `supabase/functions/<name>/index.ts` (Deno) | 16 functions; many are vestigial — most calls now hit the Node API. |
| Storage buckets | `menu-images`, `logos` | Defined in SQL migrations. |
| Realtime | `supabase.channel(...)` on the client | Used for orders, notifications, kitchen display. |
| RPC | `supabase.rpc("generate_order_number")` | The only RPC called from app code. |
| Migration ops | `server/scripts/apply-migration.js` | Applies one or more `*.sql` files in their own transactions. |

See [`backend.md`](backend.md) §3 for how Express talks to Postgres directly via `pg.Pool`, and [`frontend.md`](frontend.md) §3 for how the web client gets its short-lived Supabase JWT.

---

## 6. Payments

- **Razorpay** — Orders API (server-side `fetch` from `server/index.js`) + browser checkout (lazy-loaded from `https://checkout.razorpay.com/v1/checkout.js`, also preloaded in `index.html`).
- **UPI** — customer-side UPI deep links (`buildUpiPayUrl` in `src/lib/upi.ts`) + UTR confirmation flow under `/api/public/orders/:id/submit-upi`.

Mobile clients **must not** open Razorpay inside the WebView (App Store / Play Store rules). The `<NativeBillingLinkButton>` and `useSubscription` hooks detect `isBanaooNativeApp()` and instead hand the user off to the **system browser** via `POST /api/billing/mobile-link` → `GET /api/billing/redeem` → `req.login` → browser session.

---

## 7. Deployment

| Surface | Platform | Notes |
|---|---|---|
| Web frontend | Dokploy (Docker, nginx) | `Dockerfile` + `nginx.conf` ship the Vite bundle. `vercel.json` exists for a Vercel-flavored deploy (used for the `/api/manifest` serverless function). |
| Web backend | Dokploy (Docker, Node) | `server/Dockerfile`. Vendored `banaoo-latest.apk` is copied into the image so the marketing site can serve it. |
| Database | Supabase (self-hosted via Dokploy in prod) | Connection via `DATABASE_URL`. SSL auto-detected; `traefik.me` hostnames disable it. |
| Edge functions | Supabase Functions | Deployed via `.github/workflows/deploy-functions.yml`. |
| Mobile binaries | EAS Build → Google Play Internal | Local APKs (`mobile/play-store/releases/`) are debug-signed and intended for sideloading only. |
| Vercel | `/api/manifest` serverless function | Dynamic Web App Manifest per-restaurant. |
| Static assets | Served by nginx (`public/`) and Vercel (`headers` in `vercel.json` immutable-caches `/assets/*`). |  |

---

## 8. Linting, formatting, & CI

- **ESLint** flat config at `eslint.config.js` covers the whole repo.
- **TypeScript** project-references (`tsconfig.json` → `tsconfig.app.json` + `tsconfig.node.json`).
- **`.github/workflows/`** — only `deploy-functions.yml` ships Supabase Edge Functions. The web and backend ship via Dokploy git pushes; the mobile binaries via EAS.
- No Jest / Vitest / Playwright suite committed.

---

## 9. Conventions worth knowing

- **Path alias**: `@/...` resolves to `src/...` in the web app (both Vite and TS know about this).
- **Brand color** flows from DB `profiles.brand_color` → `brandColorCssVars(hex)` → injected CSS variables on the customer-app root element. Tailwind reads `hsl(var(--primary))` so every `bg-primary` reacts. See [`frontend.md`](frontend.md) §13.
- **Business types & operation modes** live in [`src/lib/business-types.ts`](../src/lib/business-types.ts) (frontend) and [`server/business-types.js`](../server/business-types.js) (backend). They drive feature gating, sidebar visibility, POS chip labels, and the `enforce_cloud_kitchen_self_service()` DB trigger.
- **Subscription billing periods**: 3 / 6 / 12 months only (no 1-month). Source of truth: [`src/lib/plans.ts`](../src/lib/plans.ts) (`BILLING_PERIOD_MONTHS`) + server-side `assertValidBillingPeriod` in `server/index.js`.
- **Terms of Service version** lives in [`src/lib/legal.ts`](../src/lib/legal.ts) and [`server/legal.js`](../server/legal.js) — bump both when policies change. The current value (`2026-05-25`) is stamped on every new account.

---

## 10. File reading order for new joiners

1. Skim this file ✅
2. [`docs/backend.md`](backend.md) — what the API server actually does
3. [`docs/frontend.md`](frontend.md) — how the web app is shaped
4. [`docs/api.md`](api.md) — every HTTP endpoint, one big reference
5. [`docs/mobile-app.md`](mobile-app.md) — the Android/iOS shell
6. Read the latest entries in [`docs/CHANGELOG.md`](CHANGELOG.md) to catch up on what shipped recently
