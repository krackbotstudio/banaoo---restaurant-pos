# Banaoo Mobile App

This folder contains the separate React Native (Expo) mobile app.

## Scope rules

- The existing PWA/web app in the repo root remains unchanged.
- Mobile app uses the same backend stack (API + Supabase) as web.
- No separate database or duplicate server is introduced.

## Setup

1. Create `.env` in this folder with:
   - `EXPO_PUBLIC_API_URL=<backend base url>`
   - `EXPO_PUBLIC_WEBAPP_URL=<pwa base url>` (recommended same domain as web app for parity webviews)
   - `EXPO_PUBLIC_SUPABASE_URL=<supabase url>`
   - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon key>`
   - `EXPO_TOKEN=<expo token>` (only for EAS CLI commands)
2. Install dependencies:
   - `npm install`
3. Start app:
   - from repo root: `npm run mobile:start`
   - or from this folder: `npm run start`

## Android emulator (quick native testing)

1. **Android Studio** → Device Manager → create/start a virtual device (AVD).
2. **JDK 21** (Temurin) and **`EXPO_PUBLIC_*`** / `.env` as in [Setup](#setup) above.
3. From **`mobile/`** run one of:
   - **`npm.cmd run android`** — standard `expo run:android` (uses your current folder; may hit Windows path-length limits in deep folders).
   - **`npm.cmd run android:emulator`** — runs **`scripts/run-android-emulator.ps1`**, which uses a short **`D:\_bnmob`** junction to the `mobile` folder (same workaround as release APK builds) then **`npx expo run:android`**. Prefer this if CMake/Ninja fails with *filename longer than 260 characters*.
   - Or double-click **`run-android-emulator.cmd`** (forwards extra args, e.g. `run-android-emulator.cmd --device`).

First run compiles a **debug** install and opens the app on the running emulator. Keep Metro running; use **`r`** in the terminal to reload.

## Splash screen vs loading

- **Native splash (Android)**: solid **`#ffffff`** only (no logo). `SplashScreen.hideAsync()` runs on first paint in [`App.tsx`](App.tsx). The launcher theme uses `android/app/src/main/res/drawable/splashscreen_logo.xml` as a same-color tile so the OS splash screen API does not show branded artwork.
- **POS shell**: WebView mounts after `InteractionManager.runAfterInteractions` (with a 2s fallback) to reduce cold-start jank. A **`Modal`** shows “Loading POS…” until `onLoadEnd` so the spinner is not hidden behind the native WebView on Android.
- **Expo Updates**: `AndroidManifest` uses **`EXPO_UPDATES_CHECK_ON_LAUNCH = NEVER`** so launch is not blocked by an EAS Update fetch; the app still checks from JS in [`PwaShellScreen.tsx`](src/screens/PwaShellScreen.tsx).

## Launcher icon and splash image (Android adaptive safe zone)

Android adaptive icons mask the foreground into a circle/squircle; artwork should sit inside the **~66% center safe zone** of a 1024×1024 image (see [Adaptive icons](https://developer.android.com/develop/ui/views/launch/icon_design_adaptive)).

- Put your **full-bleed** logo in `assets/icon.png` (high resolution), then from **`mobile/`** run:
  - **`npm.cmd run icons:generate`** — writes padded **`adaptive-icon.png`**, **`icon.png`**, and **`splash.png`** (white background, logo scaled to fit the safe zone).
- Re-running on **already padded** `icon.png` will shrink the logo again; replace `icon.png` with your master artwork before each generate if you need to tweak.
- Rebuild the native app (`expo prebuild` / EAS / local Gradle) so the new bitmaps are packaged.

## WebView-first architecture

- The app now loads the full deployed POS PWA in a single WebView shell.
- This guarantees route, auth, onboarding, and UI parity with the web product.
- Native code is used primarily for device integrations, especially BLE ESC/POS printing.

## Native print bridge

- PWA print actions (kitchen + billing) post messages to the React Native WebView host.
- The host resolves printer settings from AsyncStorage and prints via native BLE.
- The shell exposes a `Printers` modal to scan devices and assign Kitchen/Billing targets.
- Per-outlet settings are used when present; otherwise global device settings are used.

## Current status

- WebView shell is the default app entry.
- Native printer modal is available from the shell header.
- Kitchen and billing print commands can be routed from PWA to native BLE bridge.
- Google auth return via deep link triggers shell reload to restore web session state.

## Build and install

### Google Play Store (AAB)

See **[App playstore deploy.md](./App%20playstore%20deploy.md)** for the full checklist, store assets, and Play Console steps.

- Build signed bundle: `build-play-store.cmd` or `npm run build:aab`
- Submit to Play: `npm run submit:play` (requires `play-store/service-account.json`)

### Sideload / website APK (local Windows)

1. `npm install`
2. Run `.\scripts\build-release-apk.ps1`
3. Output: `android/app/build/outputs/apk/release/banaoo-app-v<version>.apk` (e.g. `banaoo-app-v0.6.apk`)

### Internal EAS APK (preview)

- `npm run build:apk` — preview profile, APK for testers

## Quick verification checklist

- Open app and confirm WebView loads `EXPO_PUBLIC_WEBAPP_URL`.
- Login with email/password and confirm dashboard loads exactly like mobile web.
- Trigger Google sign-in and confirm app returns to shell and logged-in session remains.
- Open `Printers` modal, scan BLE devices, and save kitchen/billing assignments.
- Place an order and confirm kitchen print reaches assigned native BLE printer.
- From Orders, run `Print Bill` and confirm billing print reaches assigned BLE printer.
- From Kitchen page, reprint and confirm native bridge prints kitchen slip.
