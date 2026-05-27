# Mobile App (`mobile/`)

A guide to the React Native / Expo shell that ships to the Google Play Store as **Banaoo** (`com.banaoo`). This document covers the architecture, the WebView ↔ web bridge that drives most features, the native printer subsystem (the real reason the app exists), and the release pipeline.

> The mobile app is **almost a pure WebView shell** around `https://banaoo.in/auth`. Native code is reserved for things browsers can't do well: ESC/POS printing over Bluetooth and TCP, system-level deep links, the splash screen, and OTA updates.

---

## 1. Folder map

```text
mobile/
├── index.ts                # Splash prevent + registerRootComponent(App)
├── formdata-polyfill.ts    # MUST be the first import — polyfills FormData before InitializeCore
├── App.tsx                 # SafeAreaProvider + AuthProvider + OutletProvider + AppNavigator
├── app.json                # Expo config — bundle ID, version, permissions, plugins
├── eas.json                # EAS build/submit profiles (preview APK / production AAB)
├── tsconfig.json           # Strict TS
├── package.json            # Expo SDK 54, RN 0.81.5, React 19.1
├── plugins/
│   ├── with-screen-orientation.js   # Force portrait/landscape behavior
│   └── with-android-release.js      # Release Gradle tweaks (BouncyCastle dedupe)
├── scripts/
│   ├── build-release-apk.ps1        # Local Gradle APK build (debug-signed sideload)
│   ├── build-release-aab.ps1        # Local Gradle AAB build (debug-signed sideload)
│   ├── build-play-aab.ps1           # Upload-keystore signed AAB for Play
│   ├── apk-version-name.ps1         # Derives versionName from app.json
│   ├── run-android-emulator.ps1     # Boots an emulator and `expo run:android`
│   ├── invoke-with-short-mobile-path.ps1   # MAX_PATH workaround (D:\_bnmob junction)
│   ├── android-build-env.ps1        # Auto-discover JDK 17–21, set ANDROID_HOME
│   └── build-adaptive-assets.cjs    # sharp-based icon/splash generator
├── play-store/
│   ├── releases/                    # AABs/APKs (also tracked by git LFS in some repos)
│   ├── service-account.json         # Google Play API service account (in .gitignore)
│   ├── screenshots/                 # Listing assets
│   └── …
├── assets/                          # icon.png, adaptive-icon.png, splash.png, favicon.png
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx         # Native-stack with PwaShell + NativePrinters
│   ├── screens/
│   │   ├── PwaShellScreen.tsx       # The main screen — WebView + bridge
│   │   ├── NativePrinterScreen.tsx  # Modal for printer setup
│   │   └── …                        # Many legacy screens (see §6)
│   ├── context/
│   │   ├── AuthContext.tsx          # Cookie-based session shared with banaoo.in
│   │   └── OutletContext.tsx
│   ├── printer/
│   │   ├── printer-service.ts       # High-level print orchestrator
│   │   ├── printer-storage.ts       # Per-outlet + global fallback persistence
│   │   ├── escpos.ts                # ESC/POS document builder
│   │   ├── bluetooth-ble-adapter.ts # react-native-ble-plx
│   │   ├── bluetooth-classic-adapter.ts # react-native-bluetooth-classic
│   │   ├── network-tcp-adapter.ts   # react-native-tcp-socket (IP:9100)
│   │   ├── web-bridge-handlers.ts   # postMessage handlers from the WebView
│   │   ├── PaperLayoutSection.tsx   # UI controls (paper width, dual-copy, calibration)
│   │   ├── paper-width.ts           # Width presets + column math
│   │   ├── receipt-layout.ts        # Receipt geometry
│   │   └── usePrinterSettings.ts    # React hook over printer-storage
│   ├── services/
│   │   ├── menu.ts                  # (Legacy) Supabase menu queries
│   │   └── orders.ts                # (Legacy) Order helpers
│   ├── lib/
│   │   ├── supabase.ts              # Mobile Supabase client
│   │   ├── config.ts                # API_URL + WEBAPP_URL from expo-constants
│   │   ├── app-version.ts           # APP_VERSION from app.json
│   │   ├── storage.ts               # AsyncStorage wrapper
│   │   ├── gst.ts                   # GST helpers
│   │   ├── menu-availability.ts     # Day/time-window logic (mirror of web's)
│   │   └── use-staff-permissions.ts
│   ├── theme/
│   │   └── tokens.ts                # Colors, spacing, font sizes
│   └── components/ui/
│       ├── AppScreen.tsx            # Screen wrapper + AppScrollScreen variant
│       └── primitives.tsx           # AppCard, AppButton, AppInput, AppTitle, AppBody
└── …
```

---

## 2. Project metadata

### `mobile/package.json`

- Name `mobile`, version `0.0.12` (note: package.json version is decoupled from app version below).
- `"main": "index.ts"`.
- Expo SDK **~54.0.33**, React **19.1.0**, React Native **0.81.5**.
- Key dependencies:
  - **Navigation**: `@react-navigation/native@7.2`, `@react-navigation/native-stack@7.14`. `@react-navigation/bottom-tabs@7.15` is installed but **currently unused**.
  - **WebView**: `react-native-webview@13.15`.
  - **Storage**: `@react-native-async-storage/async-storage@2.2`.
  - **Splash & updates**: `expo-splash-screen@31`, `expo-updates@29`.
  - **Browser & deep linking**: `expo-web-browser@15`, `expo-linking@8`.
  - **Bluetooth**: `react-native-ble-plx@3.5` (BLE), `react-native-bluetooth-classic@1.73-rc.17` (Classic SPP).
  - **Network**: `react-native-tcp-socket@6.2` (raw IP:9100).
  - **Supabase client**: `@supabase/supabase-js@2.103`.
- Dev tooling: `eas-cli@18.12`, `sharp@0.34` (icon generation), `typescript@5.9`.
- Scripts:
  - `start` → `expo start`
  - `android` → `expo run:android`
  - `ios` → `expo run:ios`
  - `web` → `expo start --web`
  - `build:apk` (and `build:apk:production`) → `eas build --platform android --profile preview`
  - `build:aab` → `eas build --platform android --profile production`
  - `build:aab:local` → PowerShell local Gradle AAB
  - `submit:play` → `eas submit --platform android --profile production --latest`
  - `android:emulator` → boots an emulator + `expo run:android`
  - `icons:generate` → `node scripts/build-adaptive-assets.cjs`

### `mobile/app.json` (Expo config) — current state

| Key | Value |
|---|---|
| `name` | `Banaoo` |
| `slug` | `banaoo-pos-mobile` |
| `scheme` | `banaoo` (deep links `banaoo://…`) |
| `version` | `0.0.18` |
| `runtimeVersion.policy` | `appVersion` (OTA runtime ties to version above) |
| `updates.url` | `https://u.expo.dev/ff1f4b1f-181e-415c-a2db-2e70d060a4f2` |
| `updates.checkAutomatically` | `ON_ERROR_RECOVERY` (no automatic OTA pulls during happy path) |
| `updates.fallbackToCacheTimeout` | `0` |
| `orientation` | `default` |
| `icon` | `./assets/icon.png` |
| `userInterfaceStyle` | `light` |
| `newArchEnabled` | `true` |
| `splash` | `./assets/splash.png`, white background, `contain` |
| `ios.bundleIdentifier` | `com.banaoo` |
| `ios.supportsTablet` | `true` |
| `android.package` | `com.banaoo` |
| `android.versionCode` | `20` (must be bumped manually for each Play release) |
| `android.edgeToEdgeEnabled` | `false` (deliberate; status bar is solid white) |
| `android.predictiveBackGestureEnabled` | `false` |
| `extra.apiUrl` / `extra.webappUrl` | `https://banaoo.in` |
| `extra.eas.projectId` | `ff1f4b1f-181e-415c-a2db-2e70d060a4f2` |
| `owner` | `krackbotstudio` |

#### Android permissions

| Granted | Reason |
|---|---|
| `BLUETOOTH`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` | Thermal printer pairing. |
| `ACCESS_FINE_LOCATION` | Required by Android BLE scan APIs prior to Android 12. |
| `INTERNET`, `ACCESS_NETWORK_STATE` | WebView + TCP printer + Supabase. |

| Blocked (`blockedPermissions`) | Reason |
|---|---|
| `ACCESS_BACKGROUND_LOCATION`, `RECORD_AUDIO`, `CAMERA`, `BLUETOOTH_ADMIN` | Removed from the manifest so Play Console doesn't flag the app for sensitive permissions we don't actually use. |

#### Plugins

- `./plugins/with-screen-orientation.js` — local config plugin to control orientation.
- `./plugins/with-android-release.js` — release Gradle tweaks (BouncyCastle dedupe to avoid "Multiple dex files" with Razorpay-flavored SDKs the web app might pull).
- `expo-web-browser`
- `expo-splash-screen` (configured with the same `./assets/splash.png`)

### `mobile/eas.json`

```jsonc
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "local" },
  "build": {
    "preview":    { "distribution": "internal", "channel": "preview",
                    "android": { "buildType": "apk" } },
    "production": { "channel": "production",
                    "android": { "buildType": "app-bundle" } }
  },
  "submit": {
    "production": {
      "android": {
        "track": "internal",
        "releaseStatus": "draft",
        "serviceAccountKeyPath": "./play-store/service-account.json"
      }
    }
  }
}
```

- `appVersionSource: "local"` — EAS does **not** auto-bump `versionCode`; you must bump it in `app.json` before each Play submission.
- `preview` profile → internal-distribution **APK** (used for direct sideload + landing-page downloads).
- `production` profile → **AAB**, uploaded by `submit:play` to the Play `internal` track in `draft` state for QA promotion.

---

## 3. Entrypoints

### `mobile/index.ts`

```ts
import "./formdata-polyfill";                       // MUST come first
import "react-native/Libraries/Core/InitializeCore"; // RN globals before App / Supabase

import { registerRootComponent } from "expo";
import * as SplashScreen from "expo-splash-screen";

import App from "./App";

void SplashScreen.preventAutoHideAsync().catch(() => {});
registerRootComponent(App);
```

The import order matters: `formdata-polyfill.ts` patches `FormData`'s prototype **before** `InitializeCore` wires React Native's globals; Supabase's signed-URL uploads otherwise crash with `formData.append is not a function` on certain Android engines.

### `mobile/App.tsx`

```tsx
<SafeAreaProvider>
  <AuthProvider>
    <OutletProvider>
      <StatusBar style="dark" translucent={false} backgroundColor="#ffffff" />
      <AppNavigator />
    </OutletProvider>
  </AuthProvider>
</SafeAreaProvider>
```

`useLayoutEffect` calls `SplashScreen.hideAsync()` — but `PwaShellScreen` will *also* call `hideAsync()` after the WebView reports load progress, so the splash stays visible until the actual web content paints (with a 22s failsafe).

---

## 4. Architecture

**Single-WebView shell.** Despite the existence of `DashboardScreen`, `KitchenScreen`, `NewOrderScreen`, `OrdersScreen`, `AuthScreen`, `MoreModulesScreen`, `SettingsScreen`, and `PwaRouteScreen` under `src/screens/`, **the only screen the navigator actually registers is `PwaShell`** (plus the modal `NativePrinters`). The other files are legacy / partial native implementations kept for reference and possible future use.

### `AppNavigator`

```tsx
<Stack.Navigator>
  <Stack.Screen name="PwaShell" options={{ headerShown: false }}>
    {({ navigation }) => (
      <PwaShellScreen onOpenPrinters={() => navigation.navigate("NativePrinters")} />
    )}
  </Stack.Screen>
  <Stack.Screen name="NativePrinters" component={NativePrinterScreen} options={…} />
</Stack.Navigator>
```

### Loading sequence

1. RN bootstraps, `formdata-polyfill` runs, splash screen is held visible.
2. `App.tsx` mounts, `AppNavigator` shows `PwaShellScreen`.
3. `PwaShellScreen` defers mounting the WebView via `InteractionManager.runAfterInteractions` (lets RN finish layout before the WebView starts loading).
4. WebView loads `${WEBAPP_URL}/auth` (default `https://banaoo.in/auth`) with a Chrome-like User-Agent: `Mozilla/5.0 (Linux; Android 13; …) … BanaooApp/<APP_VERSION>`.
5. **Before page load** the bridge injects:
   ```js
   window.__BANAOO_NATIVE_PRINTER_BRIDGE__ = true;
   window.__BANAOO_NATIVE_APP__ = true;
   ```
   so the web app's `isBanaooNativeApp()` detection works on first paint.
6. **After load** it deletes `navigator.serial` so the web printer pipeline falls through to the native bridge instead of trying to use Web Serial in the WebView.
7. As soon as `onLoadEnd`, `onLoadProgress` ≥ 90%, or `onHttpError` fires (whichever comes first), the splash is hidden. A 22s failsafe (`PAGE_READY_FAILSAFE_MS`) prevents the splash from getting stuck if those events never fire.
8. Every 5 minutes the shell polls `expo-updates` (`OTA_CHECK_INTERVAL_MS`) but only **applies** an update on error (`checkAutomatically: ON_ERROR_RECOVERY`).
9. The shell also calls `GET /api/mobile-app/update-policy` on focus and force-redirects to the Play Store if `forceUpdate: true` and the current `versionName` is less than `minVersion`.

---

## 5. WebView ↔ Web bridge

The bridge is a **`window.ReactNativeWebView.postMessage`** channel (web → native) plus **`CustomEvent` dispatch** (native → web via `injectJavaScript`).

### Web → native (6 message types)

| `type` | Payload | What native does |
|---|---|---|
| `banaoo-native-print` | `role`, `requestId`, `payload` | Prints kitchen / billing / customer-token / kitchen-handoff / test slip. Returns result via `banaoo-native-print-result` CustomEvent (matched by `requestId`). |
| `banaoo-native-open-printers` | – | `navigation.navigate("NativePrinters")` (printer setup modal). |
| `banaoo-native-open-billing` | `url` | `WebBrowser.openBrowserAsync(url)` — system browser opens the billing redeem URL. On dismiss, fires `banaoo-billing-complete` event in the WebView. |
| `banaoo-native-sync-printer` | `payload` (`WebSyncPrinterPayload`) | Persists a printer config (per-outlet) coming from the web fleet UI. |
| `banaoo-native-sync-self-service` | `payload` | Persists self-service toggles (print-on-order, bill-with-handoff, kitchen station copy). |
| `banaoo-native-scan-bluetooth` | `mode: "ble"\|"classic"` | Scans paired devices; returns via `banaoo-bt-scan-result` CustomEvent. |

### Native → web (3 events)

| Event | Fired by | Payload |
|---|---|---|
| `banaoo-native-print-result` | After every print attempt | `{ requestId, ok, message?, error? }` — corresponds to a single `banaoo-native-print` message. |
| `banaoo-bt-scan-result` | After a `banaoo-native-scan-bluetooth` request | `{ mode, devices: [{ id, name }] }`. |
| `banaoo-billing-complete` | When the `WebBrowser` session dismisses | (no payload) — `useSubscription` listens and refetches `/api/subscription`. |

### Global flags injected into the WebView

```js
window.__BANAOO_NATIVE_PRINTER_BRIDGE__ = true;
window.__BANAOO_NATIVE_APP__ = true;
```

These are read by `src/lib/native-app-bridge.ts` and `src/lib/native-print-bridge.ts` on the web side (see [`frontend.md`](frontend.md) §9).

### Why this design

The web pipeline knows how to talk to Web Serial / WebUSB printers, but those APIs aren't available in WebViews. By deleting `navigator.serial` and routing every print through the bridge, the **same** print code paths in `src/lib/print-*.ts` work both in the browser (via Web Serial) and on Android (via BLE/Classic/TCP) without conditionals at the call site.

---

## 6. Screens

The navigator currently registers only `PwaShell` + `NativePrinters`. The other files under `src/screens/` are legacy native implementations:

| Screen | Status | Notes |
|---|---|---|
| `PwaShellScreen.tsx` | **Live** | Hosts the WebView + bridge + OTA + force-update + billing handoff. |
| `NativePrinterScreen.tsx` | **Live** (modal) | Add/edit BLE/Classic/TCP printers, paper width, dual-copy, calibration, test-print. |
| `AuthScreen.tsx` | Dead code | Earlier native login form. Replaced by the web `/auth` page rendered in the WebView. |
| `DashboardScreen.tsx`, `KitchenScreen.tsx`, `NewOrderScreen.tsx`, `OrdersScreen.tsx`, `SettingsScreen.tsx`, `MoreModulesScreen.tsx` | Dead code | Partial native re-implementations of the corresponding admin pages. Kept as reference for any future native flagship-feature rewrite. |
| `PwaRouteScreen.tsx` | Dead code | Older variant of `PwaShellScreen` for sub-route hosting. |

> **Do not delete the unused screens** without checking with the team — some files (especially `KitchenScreen.tsx`, `NewOrderScreen.tsx`) hold patterns we may want to revive when we go native-first for a flagship feature.

---

## 7. Printer subsystem (`src/printer/`)

The single biggest reason this app exists as a native shell. Every order in the admin POS, kitchen display, and customer self-service flow triggers a `banaoo-native-print` message that funnels into this subsystem.

### 7.1 ESC/POS document builder — `escpos.ts`

- Pure functions that emit a `Uint8Array` of ESC/POS bytes given a typed receipt model (title, lines, items, totals, footer).
- Handles:
  - Two paper geometries: 58 mm (32 columns) and 80 mm (48 columns), plus 40 / 76 / 90 / custom widths via `paper-width.ts`.
  - Dual-copy ("Customer / Kitchen") with a 1.8 s cut delay between copies (`SELF_SERVICE_CUT_DELAY_MS`).
  - Bold/double-width headers, item columns, totals row, footer ("Thank you" + business address).
  - **Sanitizes ₹ → "Rs."** and strips U+202F (narrow no-break space) because most thermal printers' code pages don't render either.

### 7.2 Transports

| Adapter | File | Library | Use |
|---|---|---|---|
| BLE | `bluetooth-ble-adapter.ts` | `react-native-ble-plx` | Modern BLE thermal printers (e.g. Munbyn IMP018). Requires `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT` on Android 12+, `ACCESS_FINE_LOCATION` before that. |
| Classic SPP | `bluetooth-classic-adapter.ts` | `react-native-bluetooth-classic` | Legacy thermal printers (Bluetooth 2.x SPP). Pairing is done in the system Bluetooth screen; adapter only enumerates paired devices. |
| TCP/IP | `network-tcp-adapter.ts` | `react-native-tcp-socket` | LAN printers. Default port 9100. |

### 7.3 Service abstraction — `printer-service.ts`

Exposes the high-level entry points called from the bridge:

- `printKitchenSlip(payload)`
- `printBillingReceipt(payload)`
- `printCustomerTokenSlip(payload)`
- `printKitchenHandoffReceipt(payload)`
- `printKitchenCancelSlip(payload)`
- `testKitchenPrint()`, `testBillingPrint()`
- `applyRuntimePaperFromPayload(payload)` (overrides paper width before printing)

Each function:

1. Loads the effective printer settings via `loadEffectivePrinterSettings(outletId, role)` (per-outlet → global fallback).
2. Selects the configured transport adapter.
3. Builds the ESC/POS document via `escpos.ts`.
4. Connects, writes, disconnects.
5. Returns `{ ok, message?, error? }`.

### 7.4 Persistence — `printer-storage.ts`

Keys in AsyncStorage:

- `printer:<outletId>` — per-outlet settings.
- `printer:default` — global fallback used when no outlet-specific config exists.

The data model (`MobilePrinterSettings`):

```ts
{
  kitchenPrinter: RolePrinterConfig,
  billingPrinter: RolePrinterConfig,
  paperWidthMm: 58 | 80 | 40 | 76 | 90 | "custom",
  customPaperColumns?: number,
  dualCopy: boolean,
  selfServicePrintOnOrder?: boolean,        // print kitchen slip automatically on customer order
  selfServiceBillWithHandoff?: boolean,     // also print bill at handoff
  selfServiceKitchenStationCopy?: boolean,  // print kitchen station copy
  updatedAt: ISOString
}
```

`RolePrinterConfig` has `{ enabled, name, transport, connectionId, networkHost, networkPort, serviceUUID, characteristicUUID }`.

### 7.5 Web bridge handlers — `web-bridge-handlers.ts`

- `handleWebSyncPrinter(payload: WebSyncPrinterPayload)` — applies a patch to the per-outlet settings for either `kitchen` or `billing` role.
- `handleWebSyncSelfServiceSettings(payload)` — applies the three self-service toggles.
- `scanBluetoothForWeb(mode)` — runs a BLE scan or returns paired Classic devices; both shapes normalized to `{ id, name }`.
- `buildBluetoothScanInjectScript(...)` / `buildPrintResultInjectScript(...)` — build the `injectJavaScript(...)` strings that fire CustomEvents back into the WebView.

### 7.6 UI — `NativePrinterScreen.tsx` + `PaperLayoutSection.tsx`

The modal opens from a CTA in the web app's Settings → Printers (`openNativePrinterSettings()`), or from the Kitchen header. It lets the user:

- Choose role (Kitchen / Billing).
- Pick transport.
- Scan BLE / list Classic / type a host:port.
- Choose paper width + dual-copy.
- Calibrate ("Test print") to verify the right number of columns.

---

## 8. Services, libs, contexts

### `src/lib/`

| File | What it does |
|---|---|
| `supabase.ts` | Mobile Supabase client, `persistSession: false` (the web cookie session is authoritative). |
| `config.ts` | `API_URL` and `WEBAPP_URL` from `Constants.expoConfig.extra` with sensible fallbacks. |
| `app-version.ts` | `APP_VERSION` derived from `Constants.expoConfig.version`. |
| `storage.ts` | `storage.getItem<T>(key)` / `setItem(key, value)` / `removeItem(key)` — typed AsyncStorage wrapper. |
| `gst.ts` | INR currency formatting + GST math (mirrors `src/lib/gst-categories.ts` on the web). |
| `menu-availability.ts` | Day/time-window scheduling (IST default), `isItemEffectivelyAvailable`. Mirror of the web side. |
| `use-staff-permissions.ts` | Resolves a staff user's allowed page keys for any native screens (currently only used by legacy code). |

### `src/context/`

- `AuthContext.tsx` — checks the cookie-based session via `/auth/me`; cookies are shared with the WebView (the shell does **not** maintain a separate session).
- `OutletContext.tsx` — outlet state for the legacy native screens; unused by the live `PwaShell` flow.

### `src/services/`

`menu.ts` and `orders.ts` are leftovers from when the native screens were used directly. They still compile but aren't on the live path.

### `src/components/ui/`

- `AppScreen.tsx` / `AppScrollScreen` — screen layout wrappers (SafeArea + padding).
- `primitives.tsx` — `AppCard`, `AppButton`, `AppInput`, `AppTitle`, `AppBody` (atomic native components).

### `src/theme/tokens.ts`

Centralized colors, spacing, font sizes used by the `NativePrinterScreen` modal.

---

## 9. Build & release

### EAS

The recommended path for any Play Store upload:

```bash
cd mobile
npm install
eas login                     # one-time (or eas:login)
npm run build:apk             # APK (preview profile) for sideload / lead capture
npm run build:aab             # AAB (production profile) for Play upload
npm run submit:play           # Uploads the latest production AAB to Play internal (draft)
```

### Local Gradle

`build-release-apk.ps1` and `build-release-aab.ps1` exist for two reasons:

1. **APK for the landing page** — a debug-signed APK is dropped into `public/downloads/banaoo-latest.apk` so anyone can sideload it via the "Get the app" CTA on banaoo.in.
2. **Faster iteration** — local builds skip EAS infra when you only need to test on a single device.

Important gotchas baked into these scripts:

- **Windows `MAX_PATH` workaround** — `invoke-with-short-mobile-path.ps1` creates a directory junction `D:\_bnmob → mobile/` and runs Gradle from the junction so the Android build doesn't blow past the 260-char `MAX_PATH` limit on Windows.
- **JDK discovery** — `android-build-env.ps1` looks for JDK 17–21 (`JAVA_HOME` → `Program Files\Java\jdk-21` → `jdk-20` → … → `jdk-17`) and throws if it finds JDK 22+ (incompatible with the Gradle wrapper).
- **Debug-signing only** — local builds use the debug keystore. **They are sideload-only.** Don't try to upload a locally built AAB to the Play Console; it will be rejected with a signing-key mismatch.

### Versioning

Two version numbers must move together for each Play release:

1. `mobile/app.json` → `expo.version` (user-visible, e.g. `0.0.18`)
2. `mobile/app.json` → `expo.android.versionCode` (integer, e.g. `20`)

`eas.json` sets `appVersionSource: "local"`, so neither number is auto-bumped by EAS. Bump them manually, commit, then run `npm run build:aab`.

### Naming

`apk-version-name.ps1` derives the output filename from `app.json` — e.g. `banaoo-app-V.0.018.apk` for version `0.0.18`. The same logic lives in the backend's `/api/mobile-app/apk` handler so direct downloads share the same filename.

### Icons & splash

`scripts/build-adaptive-assets.cjs` (Node + `sharp`) regenerates `assets/adaptive-icon.png`, `assets/icon.png`, `assets/splash.png` from a single source image. Run with:

```bash
npm run icons:generate
```

### OTA updates (Expo)

- Channel `preview` for the APK profile, `production` for the AAB profile.
- `runtimeVersion.policy: "appVersion"` means an OTA only applies to clients on the **same** `version` (e.g. `0.0.18`). Bumping `version` invalidates older OTAs (intended — for binary-incompatible JS changes).
- `checkAutomatically: ON_ERROR_RECOVERY` means the app *only* tries to pull an OTA after a JS crash. The 5-minute interval in `PwaShellScreen` is the manual fallback that uses `Updates.checkForUpdateAsync()` + `Updates.fetchUpdateAsync()` when conditions align.

### Force update

`PwaShellScreen` calls `GET /api/mobile-app/update-policy` on foreground events. When `forceUpdate: true` and the current `versionName` is less than `minVersion`, the shell blocks the WebView with a non-dismissable modal and offers a "Update now" button that deep-links to the Play Store.

---

## 10. Assets

`mobile/assets/`:

| File | Use |
|---|---|
| `icon.png` | App icon source (1024×1024). |
| `adaptive-icon.png` | Android adaptive icon foreground. |
| `splash.png` | Splash screen (white background, `contain` fit). |
| `favicon.png` | Web fallback when `expo start --web` is used. |

All four are kept consistent via `scripts/build-adaptive-assets.cjs`.

---

## 11. Quirks and gotchas

These are the things that have bitten us before. Read this section *first* if a build fails or a feature behaves oddly.

1. **Import order is sacred.** `formdata-polyfill.ts` must run *before* `InitializeCore` (RN globals). The two `import "…"` statements in `index.ts` are correctly ordered — don't move them.
2. **`runtimeVersion: appVersion` invalidates OTAs on version bumps.** Plan binary releases accordingly.
3. **`checkAutomatically: ON_ERROR_RECOVERY`** means OTAs only apply after a JS crash. Don't expect "publish via EAS and users get the update next launch."
4. **`navigator.serial` is deliberately removed from the WebView.** If you ever debug a "printer not found" issue, check that this isn't being polyfilled accidentally.
5. **Android-only Bluetooth settings intent.** `openNativePrinterSettings()` on the web posts `banaoo-native-open-printers`, but the system Bluetooth settings shortcut inside `NativePrinterScreen` uses an Android `Intent`; on iOS it falls back to `Linking.openSettings()`.
6. **BouncyCastle dedupe** lives in `plugins/with-android-release.js`. If you ever see "Duplicate class org.bouncycastle.…" during a Gradle release, that plugin is the place to add new excludes.
7. **₹ → "Rs." sanitisation** is intentional in `escpos.ts`. Many thermal printers' code pages don't render U+20B9.
8. **U+202F (narrow no-break space) stripping** is intentional in the same file. It appears in some `Intl.NumberFormat` outputs and prints as a glyph block.
9. **`@react-navigation/bottom-tabs` is installed but unused.** It's a vestige of an earlier native-first prototype. Don't remove it without checking with the team.
10. **`appVersionSource: "local"`** in `eas.json` means **you** are responsible for `versionCode` increments. EAS will not refuse to build with a duplicate `versionCode`, but Play Console will reject the AAB.
11. **Local Gradle builds are debug-signed.** Sideload only — never upload to Play.
12. **The `D:\_bnmob` junction is a Windows-only workaround.** On macOS/Linux, the local Gradle scripts won't apply; use EAS instead.
13. **Splash screen has two hide points** — once in `App.tsx` (`useLayoutEffect`) and once in `PwaShellScreen` (after WebView loads). The 22-second failsafe in `PwaShellScreen` handles cases where `onLoadEnd` never fires.
14. **Chrome-like UA spoofing.** Some web frameworks block "WebView" UAs; the shell passes a Chrome-like UA suffixed `BanaooApp/<version>` so PWA detection and Razorpay checkout work.

---

## 12. Where to read next

- **How the web side talks to this shell**: [`frontend.md`](frontend.md) §9
- **The endpoints the shell calls (`/api/billing/mobile-link`, `/api/mobile-app/*`)**: [`api.md`](api.md) §6 + §11
- **What ships when**: [`CHANGELOG.md`](CHANGELOG.md)
- **Dev-session notes** (splash, printer parity, etc.): [`DEV-LOG.md`](DEV-LOG.md)
