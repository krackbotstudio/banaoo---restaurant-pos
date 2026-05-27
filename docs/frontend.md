# Frontend (`src/`)

A guide to the React web app — the **same bundle** serves the admin POS, the customer ordering app, the affiliate portal, and the public marketing site. This document focuses on shape, conventions, and where to look when you're hunting for something. The library inventory lives in [`techstack.md`](techstack.md).

---

## 1. Folder map

```text
src/
├── App.tsx                  # Provider stack + full route table (lazy-loaded pages)
├── App.css                  # Minimal global tweaks
├── main.tsx                 # ReactDOM mount; PWA install-prompt capture; SW register
├── index.css                # Tailwind layers + CSS custom properties (light/dark)
├── vite-env.d.ts            # Vite env typing
├── components/              # All React components (UI primitives + features)
│   ├── ui/                  # shadcn/ui + Radix primitives + custom (page-header, stat-card, empty-state)
│   ├── affiliate/           # AffiliateLayout, AffiliateSidebar, AffiliateProtectedRoute
│   ├── billing/             # NativeBillingLinkButton (mobile-app handoff)
│   ├── customer/            # Public ordering helpers (QR, install banner, table picker)
│   ├── docs/                # DocsLayout, DocsSidebar, DocsMarkdown (react-markdown)
│   ├── floor-plan/          # Table editor + viewer + table cards + grid view
│   ├── integrations/        # Swiggy/Zomato platform badge + config modal
│   ├── landing/             # Navbar, Footer, HeroBackground, PricingComparison
│   ├── menu/                # AvailabilityScheduleSection, BulkEditMenuDialog
│   ├── notifications/       # NotificationCenter (bell + list)
│   ├── order/               # POS order chain: OrderTypeStep, OrderFlowBar, CartDrawer, …
│   ├── outlet/              # OutletPaymentSettings (UPI / online payments)
│   ├── payments/            # UpiQrUpload
│   ├── printers/            # Fleet UI (AddPrinterWizard, CategoryPrinterMapping, PrinterFleetSettings, PrintJobLog)
│   ├── settings/            # PrinterSettings, PaperLayoutControls, ReceiptAlignmentControls
│   ├── seo/                 # SEO.tsx — Helmet wrapper + JSON-LD builders
│   ├── support/             # SupportChatWidget, ChatMessage
│   ├── tools/qr-menu/       # QR-menu builder forms / preview / share / QR display
│   ├── AppLayout.tsx        # Auth-shell layout (sidebar + topbar + bottom nav + TrialBanner)
│   ├── AppSidebar.tsx       # Sidebar nav (feature-gated + staff permissions)
│   ├── CookieConsent.tsx
│   ├── ErrorBoundary.tsx
│   ├── FeatureGate.tsx      # FeatureGate / FeatureBadge / LimitIndicator
│   ├── MenuImportDialog.tsx
│   ├── NavLink.tsx
│   ├── ProtectedRoute.tsx   # Auth + onboarding + staff-permissions gate
│   ├── TableSelector.tsx
│   └── TrialBanner.tsx
├── content/
│   └── docs/                # Public-docs registry + markdown articles (rendered at /docs)
│       ├── registry.ts
│       └── articles/*.md
├── context/                 # Customer-app-only contexts
│   ├── cart-context.tsx     # localStorage cart per outletId
│   └── customer-context.tsx # Phone-based customer + addresses
├── hooks/                   # Reusable React hooks
├── integrations/
│   └── supabase/            # Generated Supabase client + Database types
├── lib/                     # Pure helpers + auth/outlet/theme contexts + print pipeline
│   └── print/               # Fleet print service (routing, executor, repo, migration)
└── pages/                   # Route components (lazy-loaded from App.tsx)
    ├── admin/Accounts.tsx
    ├── affiliate/*
    ├── customer/*           # Customer ordering app
    └── tools/*              # QR menu builder + menu viewers
```

---

## 2. Entrypoint & provider stack

### `src/main.tsx`

```ts
// captures beforeinstallprompt BEFORE React mounts (so the PWA prompt
// is never lost if React loads late) and registers /sw.js for installability
createRoot(document.getElementById("root")!).render(<App />);
```

### `src/App.tsx` provider stack (outer → inner)

```tsx
<HelmetProvider>             {/* react-helmet-async — must be outermost */}
  <ThemeProvider>            {/* light/dark class on <html>, localStorage[app_theme] */}
    <QueryClientProvider client={queryClient}>
      <AuthProvider>         {/* /auth/me + Supabase JWT sync */}
        <OutletProvider>     {/* outlets fetched after auth, selection in localStorage */}
          <TooltipProvider>
            <Toaster />       {/* shadcn/Radix toasts */}
            <Sonner position="top-right" /> {/* sonner toasts (used by backend errors) */}
            <SupportChatWidget />
            <BrowserRouter>
              <CookieConsent />
              <ErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>{/* … */}</Routes>
```

A single `QueryClient` is constructed in `App.tsx` with **no global overrides** — TanStack defaults (stale time 0, refetch on window focus) apply.

---

## 3. State management

### Contexts

| Provider | Lives at | Exposes | Notes |
|---|---|---|---|
| `AuthProvider` | `src/lib/auth.tsx` | `{ user, profile, loading, profileLoading, signIn, signUp, signInWithGoogle, signOut, resetPassword, updatePassword, refreshProfile, getImageUrl }` | On mount calls `${API_URL}/auth/me` with `credentials: "include"`. On 200, calls `syncSupabaseSession()` which `POST`s `/auth/supabase-token` and hands the JWT to `supabase.auth.setSession()` so `auth.uid()` aligns with `public.users.id` for RLS. |
| `OutletProvider` | `src/lib/outlet-context.tsx` | `{ currentOutlet, outlets, setCurrentOutlet, loading, canSwitchOutlets }` | Owners → all outlets they own; staff → outlets via `staff_outlet_assignments`. Selection persisted in `localStorage["selectedOutletId"]`. Only `owner`/`manager` can switch. |
| `ThemeProvider` | `src/lib/theme.tsx` | `{ theme, setTheme, toggleTheme }` + `useProfileThemeSync(profileTheme)` | Persists in `localStorage["app_theme"]`. **App boots in dark mode** (`html { @apply dark scroll-smooth; }` in `index.css`). |
| `CartProvider` | `src/context/cart-context.tsx` | `{ items, outletId, addItem, removeItem, updateQty, clearCart, total, itemCount }` | Customer-ordering only. Persisted in `localStorage["cart_<outletId>"]`. |
| `CustomerProvider` | `src/context/customer-context.tsx` | Phone-based customer + addresses (`customers` + `customer_addresses` tables) | Customer-ordering only. Persisted in `localStorage["banaoo_customer"]`. |

### React Query usage

Currently concentrated in `hooks/use-print-fleet.ts` (printers, mappings, settings). Most other data is fetched with `useEffect` + the Express API or `supabase-js` directly. There is room to migrate more reads into React Query.

### Toasts

Two systems coexist:

- **Sonner** (`<Sonner />`) — used for backend errors / successes (`toast.error`, `toast.success`).
- **shadcn/Radix toaster** (`<Toaster />` + `useToast`) — used for inline form/UI feedback.

Either is fine — they don't conflict.

### Realtime

- Notifications: `useNotifications` subscribes to `supabase.channel("notifications-changes")` and plays a chime via `useNotificationSound` (Web Audio API).
- Kitchen orders: `useKitchenOrderSound` plays `/sounds/kitchen-new-order.mp3` via `HTMLAudioElement`. Enable/disable in `localStorage["banaoo-kitchen-sound-enabled"]`. First gesture priming via `unlockAudio()`.

### Speech recognition

POS new-order flow uses the native `SpeechRecognition` / `webkitSpeechRecognition` API. Declared at module scope in `pages/NewOrder.tsx`.

---

## 4. Routing

`<BrowserRouter>` + lazy-loaded pages. Auth-gated routes are wrapped in `<ProtectedRoute>` which checks:

1. Authenticated? (else → `/auth`)
2. `account_status === 'approved'`? (else → `/account-pending`)
3. `onboarding_completed === true`? (else → `/onboarding`, unless the path is in `ONBOARDING_EXEMPT_ROUTES`: `/onboarding`, `/settings`, `/account-pending`, `/admin/accounts`, `/billing/checkout`)
4. For staff sessions: page key allowed by `useStaffPermissions()`? (else → fallback dashboard)

### Route table

**Public**

| Path | Component |
|---|---|
| `/` | `Landing` |
| `/auth` | `Auth` |
| `/auth/callback` | `AuthCallback` (silent OAuth redirector) |
| `/about` | `About` |
| `/pricing` | `Pricing` *(noindex, hidden from nav)* |
| `/terms`, `/privacy`, `/refund`, `/shipping` | Legal pages |
| `/docs`, `/docs/:slug` | `Docs`, `DocsArticle` |
| `/affiliate` | `Affiliate` (public landing) |
| `/affiliate/auth` | `AffiliateAuth` |
| `/staff-login` | `StaffLogin` |
| `/tools/qr-menu-builder` | QR Menu Builder |
| `/m/:menuData` | LZ-compressed URL menu viewer |
| `/menu/:slug` | Saved (DB) menu viewer |

**Customer-facing ordering (public)**

| Path | Component |
|---|---|
| `/order/:slug/*` | `customer/BrandApp` — outlet picker → flow |
| `/r/:outletId/*` | `customer/RestaurantApp` — direct-outlet flow |

**Auth-gated**

| Path | Component |
|---|---|
| `/billing/checkout` | `BillingCheckout` (mobile handoff) |
| `/account-pending` | `AccountPending` |
| `/onboarding` | `Onboarding` |
| `/dashboard`, `/outlets[/:id]`, `/menu`, `/orders[/new]`, `/kitchen`, `/payments`, `/staff`, `/customers`, `/analytics`, `/order-history`, `/inventory`, `/integrations`, `/my-menus`, `/settings`, `/addons` | Owner / staff pages |

**Admin**

| Path | Component |
|---|---|
| `/admin/account` → `<Navigate>` → `/admin/accounts` |
| `/admin/accounts` | `admin/Accounts` |

**Affiliate portal** (`<AffiliateProtectedRoute><AffiliateLayout />`):

`/affiliate/dashboard`, `/affiliate/referrals`, `/affiliate/commissions`, `/affiliate/payouts`, `/affiliate/marketing`, `/affiliate/settings`.

**Catch-all**: `<Route path="*" element={<NotFound />} />`.

---

## 5. UI library & design system

### shadcn/ui + Radix

- `components.json` selects style `default`, base color `slate`, `cssVariables: true`, aliases `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`.
- `src/components/ui/` ships the full shadcn set (accordion, dialog, dropdown-menu, sidebar, table, tabs, toast, etc.) plus three **custom primitives**:
  - `page-header.tsx` — sticky glassy header with optional back/logout buttons.
  - `stat-card.tsx` — KPI card (icon, value, trend, color variant).
  - `empty-state.tsx` — dashed placeholder with CTA.

### Tailwind theme (`tailwind.config.ts`)

- `darkMode: ["class"]`.
- Every color bound to `hsl(var(--…))` so the app supports per-restaurant brand overrides (see §13).
- `fontFamily.sans = fontFamily.display = ["DM Sans", "system-ui", "sans-serif"]` (DM Sans preloaded in `index.html`).
- Extra radii: `--radius` lg + `2xl`, `3xl`.
- Keyframes: `accordion-down/up`, `fade-in`, `scale-in`, `slide-in-right`.
- Plugins: `tailwindcss-animate`, `@tailwindcss/typography` (used by `/docs`).

### CSS layer (`src/index.css`)

- `:root` defines a "warm CookUp" palette in HSL — `--primary: 24 95% 53%` (warm orange), `--accent: 38 92% 50%` (amber), neutrals tinted 30°. `.dark` overrides them.
- `html { @apply dark scroll-smooth; }` — **dark by default**.
- Utility classes worth knowing: `.gradient-primary`, `.gradient-warm`, `.gradient-sunset`, `.glow-primary`, `.glow-accent`, `.glass`, `.glass-strong`, `.shadow-subtle/elevated/warm`, `.hover-lift`, `.animate-fade-in/-float/-pulse-slow/-slide-up`, `.touch-target` (48×48 min for mobile taps), `.text-balance`.

---

## 6. Key flows

### 6.1 Auth (login / signup + Google + T&C)

- `pages/Auth.tsx` owns four sub-states: `login`, `signup`, `forgot-password`, `main`. On mount it pings `/auth/me`; if 401, it `POST`s `/auth/clear-session` to scrub stale cookies.
- Email signup calls `AuthProvider.signUp(email, password, fullName, phone, { terms_version })`. The current version is sourced from [`src/lib/legal.ts`](../src/lib/legal.ts) (`CURRENT_TERMS_VERSION = "2026-05-25"`).
- Google sign-in (signup context):
  1. If the T&C checkbox isn't ticked, a `useToast` error fires and the request aborts.
  2. Client `POST`s `/auth/google/prepare` with `{ terms_version }` so the server can stamp acceptance on the new account.
  3. `window.location.href = ${API_URL}/auth/google?redirect_uri=${origin}/auth/callback`.
- `pages/AuthCallback.tsx` waits for `AuthProvider` to hydrate then routes by state:
  - no profile → `/auth`
  - staff role → `/dashboard`
  - admin → `/dashboard`
  - `account_status` rejected/pending → `/account-pending`
  - `!onboarding_completed` → `/onboarding`
  - else → `/dashboard` with a sonner welcome toast.
- Staff variant: `pages/StaffLogin.tsx` — username + 4-digit PIN. Internally calls `signIn("<user>@banaoo-staff.app", "bn_<pin>")`.

### 6.2 Onboarding (business-type → outlet)

`pages/Onboarding.tsx`, 2 steps with a progress bar:

1. **Business type** — grid of `BUSINESS_TYPES` from [`src/lib/business-types.ts`](../src/lib/business-types.ts). Live: `restaurant`, `hotel`, `cloud_kitchen`, `cafe`, `qsr`, `bar`. Coming-soon (disabled): `sweet_shop`, `bakery`, `food_cart`, `resto_bar`. Each carries a `defaultOperationMode` (`standard` vs `self_service`).
2. **Business details** — brand name (required), phone, city. On submit:
   ```
   POST /api/onboarding/complete
   { business_type, brand_name, ordering_slug, phone, city }
   ```
   `ordering_slug` is generated client-side as `lowercased-name-<4char-random>`. Server seeds/renames the first outlet idempotently and stamps `operation_mode` from the business type.

A "Skip for now" path calls `POST /api/onboarding/skip` and navigates straight to `/dashboard`.

### 6.3 POS new-order flow

`pages/NewOrder.tsx` — the centerpiece of the admin POS.

```
NewOrder (page)
└─ AppLayout
   ├─ Step 1: OrderTypeStep                ← Dine-In/Takeaway + FloorPlanModal table pick
   │  (skipped for self-service / QSR / cloud-kitchen outlets)
   ├─ OrderFlowBar                         ← business-type-aware badge (Cloud Kitchen, QSR, Self-Service, etc.)
   ├─ Search + VoicePOSOrder (SpeechRecognition)
   ├─ CategoryTabs                         ← scroll-aware category bar
   ├─ MenuItemCard × items (filtered by `isItemEffectivelyAvailable`)
   ├─ CartSummaryBar (mobile) / CartDrawer
   └─ OrderSuccessDialog                   ← receipt + print/handoff buttons
```

State involved:

- Local `useState` for `orderType`, `tableNumber`, `cart: CartItem[]`, `step`, `searchQuery`, voice state.
- `useOutlet()` → current outlet's `gst_categories`, `operation_mode`.
- `useAuth()` → `profile.business_type` → `getBusinessCapabilities()` + `getOrderModeBadge()` drive the chip in `OrderFlowBar`.
- `isSelfServiceMode(outlet.operation_mode)` skips Step 1 entirely.
- `usePrintFleet(outletId)` returns `fleetContext`, passed to `printKitchenOrderSlip` (`src/lib/print-kitchen.ts`) on submit.
- On submit: order POSTed to backend → kitchen slip printed (fleet + native bridge if running in APK) → `OrderSuccessDialog` opens.

### 6.4 Customer ordering

Two entry points:

- `/order/:slug` → **`pages/customer/BrandApp.tsx`**. Looks up the owner by `ordering_slug`, fetches all `is_active` outlets, optionally geolocates the user and renders a Leaflet map sorted by distance. Selecting an outlet mounts `<CustomerProvider>` → `<OutletOrderingFlow>`.
- `/r/:outletId` → **`pages/customer/RestaurantApp.tsx`**. Direct outlet link (backward-compatible).

**`OutletOrderingFlow.tsx`** is the actual shell:

- Wraps in `<CartProvider outletId={outlet.id}>`.
- Calls `useDynamicManifest({ name, startUrl, themeColor })` to swap `<link rel="manifest">` to `/api/manifest?...` so Chrome installs *this* restaurant as a PWA.
- Applies `style={brandColorCssVars(branding.brand_color)}` on the root so `bg-primary` / `text-primary` flip to the restaurant's color.
- Routes: `MenuPage` (index), `cart`, `checkout`, `payment/:orderId`, `confirmed/:orderId`, `orders`, `phone`, `setup`. Bottom tab bar shows Menu / Cart (badge from `useCart().itemCount`) / Orders.

### 6.5 Kitchen display

`pages/Kitchen.tsx` — queries open orders via `supabase` and subscribes to realtime changes. New orders trigger a chime via `useKitchenOrderSound`. One-tap workflow: every `pending`/`preparing` order's primary button advances it to `completed` (Ready for pickup). KOTs print via `usePrintFleet` + `printKitchenOrderSlip`.

If running inside the APK (`isNativePrinterBridgeExpected()`), a header "Open Printer Settings" button calls `openNativePrinterSettings()` to deep-link into the native printer screen.

### 6.6 Settings

`pages/Settings.tsx` is a tabbed mega-page (~1500 LOC):

- **Profile** — brand name, full name, phone, theme toggle, business-type picker.
- **Brand** — `brand_color` color picker. On save, customer pages immediately reflect via `brandColorCssVars()` (see §13).
- **Subscription** — uses `useSubscription()`. Period selector reads `BILLING_PERIOD_MONTHS = [3, 6, 12]` (default 3); discount badges (5/10/20%); web `createOrder()` runs Razorpay, mobile path uses `<NativeBillingLinkButton>` which calls `createMobileBillingLink` → `openBillingInExternalBrowser`.
- **Printers** — fleet UI (`components/printers/*`) + legacy single-printer (`components/settings/PrinterSettings.tsx`, `PaperLayoutControls`, `ReceiptAlignmentControls`). Migration from legacy localStorage to the DB-backed fleet handled by `usePrintFleet` via `migrateLegacyPrintersIfEmpty()`.

### 6.7 Admin accounts

`pages/admin/Accounts.tsx` — admin-only screen (route gated by `<ProtectedRoute>`, admin check inside the page using `profile.is_admin`). Lists accounts from `/api/admin/accounts`; tabs filter by `account_status`. Per-account actions: approve, reject, suspend. Uses `<StatCard>` for counts, `<Tabs>`/`<Card>`, sonner toasts.

---

## 7. Hooks (`src/hooks/`)

| Hook | What it does |
|---|---|
| `use-subscription.ts` | Source of truth for billing. Fetches `/api/subscription`, exposes `subscription`, `addons`, `effectiveLimits`, `usage`, `hasActiveSubscription`, `daysUntilExpiry`; `createOrder`, `purchaseAddon`, `cancelSubscription` with native-app fallback via `createMobileBillingLink` / `openBillingInExternalBrowser`. Refetches on `BILLING_COMPLETE_EVENT`. |
| `use-affiliate.ts` | Loads affiliate, referrals, commissions, payouts via Supabase + `/api/affiliate/me`; computes stats; `requestPayout`, `updatePaymentDetails`. |
| `use-feature-gating.ts` | Thin wrapper over `useSubscription()` returning `{ limits, canAccess, getLimit, isWithinLimit, getUpgradeMessage, isAddonFeature, getUsageCount }`. |
| `use-notifications.ts` | Fetches `notifications` rows for the user, subscribes to realtime INSERTs, plays a chime, mirrors `Notification` API; CRUD helpers. |
| `use-notification-sound.ts` | Two-tone chime via Web Audio API. |
| `use-kitchen-order-sound.ts` | Plays `/sounds/kitchen-new-order.mp3`. Persists enable/disable in `localStorage["banaoo-kitchen-sound-enabled"]`. |
| `use-print-fleet.ts` | Wraps the printer-fleet repo in React Query (printers, mappings, settings); auto-migrates legacy localStorage; returns `fleetContext`. |
| `use-platform-integrations.ts` | Loads `platform_integrations` for the current outlet; `isConnected(platform)`. |
| `use-pwa-install.ts` | Reads cached `beforeinstallprompt` from `window.__pwaInstallPrompt`; `{ shouldShow, isIOS, hasNativePrompt, install }`. |
| `use-dynamic-manifest.ts` | `useLayoutEffect` swap of `<link rel="manifest">` to `/api/manifest?name=...&start_url=...&color=...` + `<meta name="theme-color">`. |
| `use-support-chat.ts` | SSE chat against `/api/support-chat`; streaming assistant chunks, error state. |
| `use-toast.ts` | shadcn/Radix toast store. |
| `use-mobile.tsx` | `window.matchMedia("(max-width: 767px)")` listener. |

---

## 8. Libs (`src/lib/`)

The largest folder. Grouped by domain:

### Contexts & state

- `auth.tsx` — `AuthProvider`, `useAuth()`. Fetches `/auth/me`, mints Supabase JWT.
- `outlet-context.tsx` — `OutletProvider`, `useOutlet()`.
- `theme.tsx` — `ThemeProvider`, `useTheme()`, `useProfileThemeSync()`.

### Business logic

- `business-types.ts` — `BusinessType` enum, `BUSINESS_TYPES`, `LIVE_BUSINESS_TYPES`, `getBusinessCapabilities`, `getDefaultOperationMode`, `getOrderModeBadge`. **Source of truth** for what each business type can do.
- `plans.ts` — `PLANS`, `PLAN_LIMITS`, `ADDON_CATALOG`, `BILLING_PERIOD_MONTHS = [3,6,12]`, `DISCOUNTS`, `calcPlanTotal`, `calcAddonTotal`, `UPGRADE_MESSAGES`. **No 1-month plan.**
- `entitlements.ts` — `SubscriptionAddons`, `EMPTY_ADDONS`, `aggregateAddonsFromRows`, `deserializeLimits`, `computeEffectiveLimits`.
- `legal.ts` — `CURRENT_TERMS_VERSION = "2026-05-25"`. Bump when Terms / Privacy / Refund change.

### Theming

- `brand-color.ts` — pure `hex → HSL → CSS-var` conversion. Returns overrides for `--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary*`. WCAG-readable foreground (luminance > 0.55 → near-black, else white).

### Native-app bridge (see also §9)

- `native-app-bridge.ts` — `isBanaooNativeApp()`, `createMobileBillingLink`, `openBillingInExternalBrowser`, `openBillingSettingsInBrowser`.
- `native-print-bridge.ts` — every RN-WebView printing/Bluetooth helper (kitchen/billing/customer-token/test prints, BLE/Classic scan + subscribe, open printer settings).
- `sync-native-self-service.ts` — Mirrors self-service print toggles to the native shell.

### Outlets / orders / receipts

- `outlet-operation.ts` — `OutletOperationMode` (`standard | self_service`), `isSelfServiceMode`, `formatOrderSourceLabel`, `isOnlineOrderSource`.
- `gst-categories.ts` — `GST_CATEGORIES`, `resolveGstRate`.
- `menu-availability.ts` — Day/time-window scheduling (IST default), `isItemEffectivelyAvailable`, `buildSchedulePayload`, `formatScheduleSummary`.
- `menu-encoder.ts` — LZ-String encode/decode for `/m/:menuData` URL menus.
- `order-receipt-totals.ts` — Pure totals math.
- `upi.ts` — `buildUpiPayUrl`, `isValidUpiVpa`, `resolvePaymentSettings`.
- `restaurant-display-name.ts` — `brand_name || full_name` fallback.

### Printing

- `print-kitchen.ts`, `print-billing.ts`, `print-customer-token.ts`, `print-self-service.ts` — High-level entry points that pick fleet/legacy/native path and format payloads.
- `printer-profiles.ts` — USB vid:pid → suggested paper layout (Epson, Star, CH340/CH343, FTDI, CP2102, BLE/Classic fallback).
- `printer-types.ts` — `PrinterTransport` labels + `DEFAULT_NETWORK_PORT = 9100`.
- `paper-width.ts` — Paper-width presets + column/mm conversion.
- `receipt-layout.ts` — Receipt geometry calculations.
- `serial-printer.ts` — Web Serial / browser ESC-POS engine (~23 KB).

### Print fleet pipeline (`lib/print/`)

- `types.ts` — `PrinterRecord`, `OutletPrintSettings`, `CategoryPrinterMapping`, `PrintJobRecord`, etc.
- `printer-repository.ts` — Supabase CRUD for `printers`, `category_printer_mappings`, `outlet_print_settings`, `print_jobs`.
- `routing-engine.ts` — `routeKitchenBatches(...)` decides which items go to which printer (category-based, billing/kitchen/bar/dessert/packing).
- `print-executor.ts` — Executes a single batch against the chosen transport (serial, network, native, browser).
- `print-service.ts` — Public surface (`printRoutedKitchen`, `printFleetHandoff`, `printFleetBill`) with retry (0/2s/10s).
- `print-queue.ts` — Offline localStorage queue.
- `legacy-adapter.ts` / `migrate-legacy.ts` — One-shot migration from legacy `usePrinterSettings` to DB-backed rows.
- `sync-native-printer.ts` — Push individual printer to the native shell.

### Permissions & misc

- `use-staff-permissions.ts` — Resolves a staff member's allowed page keys (looks up `staff_members` by `system_email`, falls back to `ROLE_DEFAULT_PERMISSIONS`). Used by `ProtectedRoute`, `AppSidebar`, `AppLayout`.
- `use-printer-settings.ts` — Legacy single-printer localStorage settings (kept to seed the fleet migration).
- `image-url.ts` — Resolves `/uploads/...` to `${API_URL}/uploads/...`.
- `api-url.ts` — `API_URL` constant. Auto-rewrites `https://banaoo.in` to `http://localhost:5001` when on `localhost` (prevents CORS during dev).
- `utils.ts` — `cn = twMerge(clsx(...))` (the shadcn util).

---

## 9. Native-app integration

The web app and the React Native WebView shell communicate via `window.ReactNativeWebView.postMessage(...)` plus capability flags injected by the host (`window.__BANAOO_NATIVE_APP__`, `window.__BANAOO_NATIVE_PRINTER_BRIDGE__`).

### Detection

- `isBanaooNativeApp()` — `true` if either injected flag is set or `ReactNativeWebView` is present on `window` / `window.top`.
- `isNativePrintCapable()`, `isReactNativePrintHost()`, `isNativePrinterBridgeExpected()` — variants for printer-specific code paths.

### Billing handoff

`<NativeBillingLinkButton>` is the canonical wrapper used by `TrialBanner`, `Settings`, and `Addons`:

- When `isBanaooNativeApp()` is **false** → renders as `<Link to={webTo}>`.
- When inside the native app → calls `openBillingSettingsInBrowser(mobileTarget)`, which `POST`s `/api/billing/mobile-link` and then posts a `banaoo-open-billing` message to the native shell so the system browser opens with the redeem URL.

This is **mandatory** — opening Razorpay inside the WebView violates Play Store / App Store rules.

### Printing

`postNativeKitchenPrint`, `postNativeBillingPrint`, `postNativeKitchenHandoffPrint`, `postNativeCustomerTokenPrint`, `postNativeTestPrint` all dispatch a `banaoo-native-print` message with a `requestId` and wait for a `banaoo-native-print-result` `CustomEvent` (20s timeout). See [`mobile-app.md`](mobile-app.md) §7 for the receiving side.

### Bluetooth scan

`postNativeBluetoothScan('ble' | 'classic')` + `subscribeBluetoothScanResult(listener)` — used by the Add-Printer wizard to discover paired BLE / Classic SPP printers.

---

## 10. Subscriptions & feature gating

### `src/lib/plans.ts`

- Plans: `starter` (Launcher), `professional` (Growth), `enterprise` (Expand).
- `BASE_PRICES = { starter: 499, professional: 699 }` (INR/month).
- `BILLING_PERIOD_MONTHS = [3, 6, 12] as const` — **no 1-month plan**. `DEFAULT_BILLING_PERIOD_MONTHS = 3`. `DISCOUNTS = { 3: 5, 6: 10, 12: 20 }` (%). `isValidBillingPeriodMonths(n)` is a type guard.
- `PLAN_LIMITS` table per plan: `kitchenDisplay`, `analytics`, `tableManagement`, `mobileAppAccess`, `platformIntegrations`, `swiggyIntegration`, `zomatoIntegration`, `customerOrdering`, `inventoryManagement`, `aiMenuImport`, plus numeric `outlets`, `staffAccounts`, `qrMenus`.
- `ADDON_CATALOG` matches the backend (`extra_outlet`, `extra_staff`, `customer_ordering`, `swiggy_integration`, `zomato_integration`, `inventory_management`).
- `UPGRADE_MESSAGES` — per-feature upsell copy used by `<FeatureGate>`.

### `src/hooks/use-subscription.ts`

- Fetches `${API_URL}/api/subscription`, parses with `parseEntitlementsResponse` (supports both new and legacy payload shapes).
- Derives `isExpired`, `isTrialing`, `isActive`, `isPastDue`, `hasActiveSubscription`, `expiresAt`, `daysUntilExpiry`.
- `openRazorpayCheckout(...)` lazy-loads `checkout.razorpay.com/v1/checkout.js` and opens a checkout modal.
- `createOrder(plan, months)` / `purchaseAddon(type, qty, months)`:
  1. Validates `months ∈ {3,6,12}`.
  2. If `isBanaooNativeApp()` → `createMobileBillingLink(...)` → `openBillingInExternalBrowser(url)` and return.
  3. Else → `POST /api/payments/create-order` → Razorpay → `verify-payment` → refetch.
- Refetches on the custom `BILLING_COMPLETE_EVENT` (fired by the native shell after the browser handoff).

### `<FeatureGate>` / `<FeatureBadge>` / `<LimitIndicator>` (`src/components/FeatureGate.tsx`)

- `<FeatureGate feature="customerOrdering" fallback={…} showUpgradePrompt>{children}</FeatureGate>` — gates children with a `Lock` placeholder + upgrade CTA. CTA splits between **Buy add-on** (`/addons`) and **Upgrade Plan** (`/pricing`) based on `isAddonFeature`.
- `AppSidebar` declares each nav item with an optional `feature` key (e.g. Inventory → `inventoryManagement`); the sidebar dims unauthorized items and routes them to upgrade prompts.

---

## 11. SEO infrastructure

### `index.html`

Ships a complete baseline: title, description, keywords, author, robots, canonical, theme-color (`#f97316`), Open Graph (1200×630 image, `og:locale: en_IN`), Twitter card, dns-prefetch / preconnect for fonts + Razorpay, plus three inline JSON-LD blocks: `Organization`, `WebSite` (with `SearchAction`), `SoftwareApplication`. Includes a `<noscript>` marketing fallback for crawlers without JS.

### `src/components/seo/SEO.tsx`

- `HelmetProvider` is the **outermost** provider in `App.tsx` so any component can write `<head>` tags.
- `<SEO>` props: `title` (auto-suffixed `" — banaoo"` unless `disableSuffix`), `description`, `path` (drives canonical + `og:url`), `image`, `type` (`website|article|product`), `noindex`, `keywords[]`, `publishedTime`, `modifiedTime`, `author`, `children` (extra meta or JSON-LD).
- `<StructuredData data={…}>` writes a `<script type="application/ld+json">` via Helmet.
- Helpers: `buildBreadcrumbList(trail)`, `buildFaqPage(items)`.

See [`SEO.md`](SEO.md) for the full audit, follow-ups, and the next steps to unlock SERP rich features.

### Sitemap

`scripts/build-sitemap.mjs` runs on `prebuild`. Generates `public/sitemap.xml` from a static list of public routes + doc article slugs (mirrored from `registry.ts`). `SITE_URL` defaults to `https://banaoo.io`.

---

## 12. In-app docs

All public docs live under `src/content/docs/`:

- `registry.ts` — exports `DOC_SECTIONS` (`start`, `operations`, `hardware`, `help`), `DOC_ARTICLES[]` (each entry: `slug`, `title`, `description`, `section`, `sectionTitle`, `lastUpdated`, `file`), plus `getDocArticle(slug)`, `getDocArticlesBySection(section)`, `formatDocDate(iso)`.
- `articles/<slug>.md` — plain markdown bodies. Read at build time via `import.meta.glob("./articles/*.md", { query: "?raw", import: "default", eager: true })`.

Render chain: `pages/Docs.tsx` (index) → `pages/DocsArticle.tsx` (`getDocArticle(slug)` → `<DocsLayout>` + `<DocsMarkdown>` using `react-markdown` + `remark-gfm`, prose-styled with `@tailwindcss/typography`). Internal links use `<Link>`; external links open `target="_blank" rel="noopener noreferrer"`.

A project rule (`.cursor/rules/public-docs.mdc`) instructs the team to update the matching `.md` and bump `lastUpdated` whenever a user-visible feature changes.

---

## 13. Brand color theming

Brand color flows DB → React → CSS custom properties:

1. Owner saves a hex value in **Settings → Brand**; the API writes it to `profiles.brand_color`.
2. `AuthProvider` exposes it on `profile.brand_color`.
3. Customer-ordering routes look up the *restaurant owner's* profile via Supabase (`BrandApp.tsx`: by `ordering_slug`; `RestaurantApp.tsx`: by `outlets.owner_id`) and pass it as `branding.brand_color`.
4. `OutletOrderingFlow` (and the picker shells) applies:
   ```tsx
   <div style={brandColorCssVars(branding.brand_color)}>…</div>
   ```
5. `src/lib/brand-color.ts` converts `#rrggbb` → HSL, picks a WCAG-readable foreground, and returns CSS-var overrides for `--primary`, `--primary-foreground`, `--ring`, `--sidebar-primary*`.
6. Because every Tailwind token is `hsl(var(--…))`, every `bg-primary`, `text-primary`, `border-primary` inside that subtree resolves to the restaurant's color.

A separate concept (`profile.app_theme = "light" | "dark"`) is handled by `ThemeProvider` (`useProfileThemeSync`) and only flips the global light/dark class on `<html>`.

---

## 14. Integrations folder

`src/integrations/` contains exactly one integration today.

### `src/integrations/supabase/client.ts`

- Reads `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` from Vite env.
- If creds are missing, creates a *placeholder* client (`https://placeholder.supabase.co`) so module imports never crash — but any real query will fail. The Express API still works without it.
- Auth options: `persistSession: true`, `autoRefreshToken: false`, `detectSessionInUrl: false`. Refresh tokens are deliberately disabled because the session is **set from Express** via `/auth/supabase-token` (see `AuthProvider.syncSupabaseSession`).
- Exported as `supabase: SupabaseClient<Database>`. The `Database` type comes from generated `src/integrations/supabase/types.ts`.

---

## 15. Build & dev configuration

### `vite.config.ts`

- Dev server: `host: "::"`, `port: 8080`.
- Proxy rules:
  - `/api` → `http://localhost:5001`.
  - `/auth` → `http://localhost:5001` **except** the SPA routes `/auth` and `/auth/callback`, which fall through to Vite via a `bypass` function (so React Router can render `Auth.tsx` / `AuthCallback.tsx`).
- Plugins: `@vitejs/plugin-react-swc` only.
- Alias: `@` → `./src`.
- Production manual chunks: `vendor-react`, `vendor-supabase`, `vendor-ui` (Radix), `vendor-charts` (recharts), `vendor-maps` (leaflet), `vendor-query` (TanStack), `vendor-forms` (react-hook-form/zod).

### `package.json` scripts

| Script | Purpose |
|---|---|
| `dev` | Vite on `:8080`. |
| `prebuild` | Regenerate `public/sitemap.xml` (`node scripts/build-sitemap.mjs`). Runs automatically before `build`. |
| `build` | Production build. |
| `build:dev` | Sitemap + dev-mode bundle (with source maps). |
| `sitemap` | Just regenerate the sitemap. |
| `lint` | ESLint with the flat config. |
| `preview` | Serve the built bundle locally. |
| `mobile:*` | Delegate to `mobile/`'s package scripts (see [`mobile-app.md`](mobile-app.md)). |

### TypeScript

- `tsconfig.json` references `tsconfig.app.json` (app code) and `tsconfig.node.json` (build scripts).
- `tsconfig.app.json` — `target: ES2020`, `module: ESNext`, `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `noEmit: true`, `strict: false`, `strictNullChecks: false`, `paths: { "@/*": ["./src/*"] }`.

---

## 16. Where to read next

- **What every endpoint returns**: [`api.md`](api.md)
- **How the backend works**: [`backend.md`](backend.md)
- **How the mobile shell hosts this app**: [`mobile-app.md`](mobile-app.md)
- **What ships when**: [`CHANGELOG.md`](CHANGELOG.md)
- **SEO baseline and follow-ups**: [`SEO.md`](SEO.md)
