# Banaoo POS — development log

_Last updated: 2026-05-14_

Use this file when returning after PC cleanup to continue the Android APK build and related work.

---

## Mobile app — splash screen & loading

- **`expo-splash-screen`** added; **`mobile/index.ts`** calls `SplashScreen.preventAutoHideAsync()` before registering the app.
- **`mobile/app.json`**: splash image points to **`./assets/splash.png`** (copy of icon); **`expo-splash-screen`** plugin configured with same asset.
- **`mobile/src/screens/PwaShellScreen.tsx`**: hides splash on WebView load end, HTTP error, ≥90% progress, 12s failsafe, or missing `WEBAPP_URL`; full-screen branded loader (logo + spinner + “Loading POS…”).
- **`mobile/index.ts`**: structure keeps splash prevention before `App` import.

---

## Mobile — native printer UI & parity with PWA

- **`mobile/src/screens/NativePrinterScreen.tsx`**: hero header with logo, callout for setup steps, **Open Bluetooth settings** (Android intent / iOS `openSettings`), receipt layout controls (feed chips, tear/cut guide, dual copies — see ESC/POS section).
- **`mobile/src/navigation/AppNavigator.tsx`**: modal title **“Native printer settings”**.

---

## Printer settings — ESC/POS layout (web + mobile)

**Goal:** configurable spacing between bills, tear/cut line, duplicate slips/copies.

### Web (`src/lib/use-printer-settings.ts`)

New fields on **`PrinterConfig`** (defaults applied in `normalizePrinterConfig`):

| Field | Purpose |
|--------|--------|
| `postPrintFeedLines` | 1–24, ESC/POS feed before cut (default **4**); lower saves paper. |
| `showTearCutLine` | Dashed “CUT / TEAR” block before final cut and between duplicate sections (default **true**). |
| `dualKitchenCopies` | Two kitchen slips in one job: **Kitchen copy** + **Table** (dine-in) or **Parcel** (takeaway). |
| `dualBillingCopies` | **Counter** + **Customer** full bill in one job with separator. |

### Builders

- **`src/lib/serial-printer.ts`**: `EscPosPrintOptions`, `buildKitchenSlip` / `buildBillingReceipt` accept optional third argument; tear helper `appendTearCutLine`.
- **`mobile/src/printer/escpos.ts`**: Same behavior for native thermal printing.
- **`mobile/src/printer/printer-service.ts`**: `RolePrinterConfig` extended with the same options; `escPosOptionsFromRole()` passed into builders.

### Call sites

- **`src/pages/Orders.tsx`**: billing serial print passes billing layout options from settings.
- **`src/components/order/OrderSuccessDialog.tsx`** + **`src/pages/NewOrder.tsx`**: kitchen serial print passes kitchen options from settings.
- **`src/components/settings/PrinterSettings.tsx`**: UI section “Receipt layout (thermal)”, test print uses options.

### PWA Settings UX (related session)

- **`src/pages/Settings.tsx`**: mobile tab picker spacing/backdrop; native printer CTA with loading + success toast.
- **`PrinterSettings.tsx`**: same CTA behavior for embedded native button.

---

## Android APK — local build status (blocked)

### Commands that work conceptually

From repo root or `mobile/`:

```powershell
cd "E:\Krackbot Studio AI Products\banaoo---restaurant-pos\mobile"
.\scripts\build-release-apk.ps1
```

Script sets **`JAVA_HOME`** (Android Studio **jbr**), **`GRADLE_USER_HOME=D:\gradle-banaoo`**, **`TEMP`/`TMP` on D:**, runs:

`gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a --no-daemon`

Expected APK path after success:

`mobile/android/app/build/outputs/apk/release/app-release.apk`

### Fixes applied for Gradle / NDK

- **`C:` had 0 bytes free** → Gradle and SDK installs failed. **`D:`** has hundreds of GB free — Gradle cache redirected to **`D:\gradle-banaoo`**.
- **NDK 27.x** under `%LOCALAPPDATA%\Android\Sdk\ndk\` was incomplete (missing `source.properties`) or install failed on full disk.
- **`mobile/android/build.gradle`** (before `apply plugin: "expo-root-project"`):

  - `ext.ndkPath` → `…\Sdk\ndk\28.2.13676358`
  - `ext.ndkVersion` → `28.2.13676358`

  Expo configure log should show **`ndk: 28.2.13676358`** (not 27.x).

### Still blocking last build attempt

- **Android SDK Build-Tools 36** (and other SDK packages) install under **`C:\Users\<user>\AppData\Local\Android\Sdk`** — **requires free space on `C:`**.
- Error seen: `Install Android SDK Build-Tools 36 … There is not enough space on the disk`.

### What to do after PC cleanup

1. Free **several GB on `C:`** (minimum practical headroom for SDK Manager).
2. Optionally open **Android Studio → SDK Manager** and confirm **Build-Tools 36** + **SDK Platform 36** (or whatever compileSdk expects) install cleanly.
3. Re-run **`mobile/scripts/build-release-apk.ps1`** or the same `gradlew` line manually.

### EAS cloud build (alternative)

Requires **`eas login`** or **`EXPO_TOKEN`**. Profile **`preview`** / **`production`** in **`mobile/eas.json`** already set **`android.buildType": "apk"`**.

```powershell
cd mobile
eas build --platform android --profile preview
```

---

## Backend / auth (reference from earlier debugging)

- Google sign-in failures traced to **PostgreSQL session store** (`connect-pg-simple`) — fix **`DATABASE_URL`** / Supabase pooler string and ensure **`session`** table exists (see **`server/migration.sql`**).

---

## Files touched (high level)

| Area | Files |
|------|--------|
| Mobile splash | `mobile/index.ts`, `mobile/app.json`, `mobile/src/screens/PwaShellScreen.tsx` |
| Mobile printers UI | `mobile/src/screens/NativePrinterScreen.tsx`, `mobile/src/navigation/AppNavigator.tsx` |
| Mobile ESC/POS | `mobile/src/printer/escpos.ts`, `mobile/src/printer/printer-service.ts` |
| Web printer settings | `src/lib/use-printer-settings.ts`, `src/lib/serial-printer.ts`, `src/components/settings/PrinterSettings.tsx`, `src/pages/Orders.tsx`, `src/components/order/OrderSuccessDialog.tsx`, `src/pages/NewOrder.tsx` |
| Android build | `mobile/android/build.gradle`, `mobile/android/app/build.gradle`, `mobile/scripts/build-release-apk.ps1` |
| Prebuild | `mobile/android/` generated by **`npx expo prebuild --platform android`** (committed if present in repo) |

---

## 2026-05-14 — session resume

- **Disk:** On this machine, **`C:` ~73 GB** and **`D:` ~210 GB** free — the old “no space for Build-Tools 36” blocker is likely gone if your PC matches; re-run the build script when Android Studio + SDK are installed.
- **`mobile/scripts/build-release-apk.ps1`**
  - Replaced Unicode **em-dash** in comments/strings with ASCII **`-`** — PowerShell was throwing *“The string is missing the terminator”* (encoding-sensitive parse failure).
  - **JDK detection:** uses existing **`JAVA_HOME`** if it points at a valid JDK (`bin\java.exe`), else tries **Android Studio `jbr`** under Program Files, Program Files (x86), and `%LOCALAPPDATA%` (including `Programs\Android\Android Studio\jbr`). Clear error lists paths that were tried.
- **This Cursor/agent environment** had no Android Studio / `%LOCALAPPDATA%\Android\Sdk` — **APK was not built here.** On your dev PC, after SDK is present: `cd mobile` then `.\scripts\build-release-apk.ps1`.

### EAS APK from this repo (2026-05-14)

- **`eas-cli`** added under **`mobile`** devDependencies; scripts: **`npm run eas:login`**, **`npm run build:apk`** (preview APK), **`npm run build:apk:production`**, **`npm run eas:whoami`**.
- **`mobile/build-apk.cmd`** runs **`npm.cmd run build:apk`** (avoids PowerShell `npm.ps1` policy issues).
- **Auth required:** run **`cd mobile` → `npm.cmd run eas:login`** once (account must match **`app.json`** `owner` / project access), or set **`EXPO_TOKEN`**, then **`npm.cmd run build:apk`**. Without login, EAS exits with *“An Expo user account is required to proceed.”*

---

_End of log — run the APK script on a machine with Android Studio + SDK; use EAS if you prefer cloud builds._
