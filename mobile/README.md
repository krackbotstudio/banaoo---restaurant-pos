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

## Build and install (APK)

1. From `mobile/`, ensure dependencies are installed:
   - `npm install`
2. Ensure EAS project is linked:
   - `npx eas-cli init --force`
3. Build production APK:
   - `npx eas-cli build --platform android --profile production --non-interactive`
4. Download artifact from the EAS build URL shown in CLI output and install on Android.

## Quick verification checklist

- Open app and confirm WebView loads `EXPO_PUBLIC_WEBAPP_URL`.
- Login with email/password and confirm dashboard loads exactly like mobile web.
- Trigger Google sign-in and confirm app returns to shell and logged-in session remains.
- Open `Printers` modal, scan BLE devices, and save kitchen/billing assignments.
- Place an order and confirm kitchen print reaches assigned native BLE printer.
- From Orders, run `Print Bill` and confirm billing print reaches assigned BLE printer.
- From Kitchen page, reprint and confirm native bridge prints kitchen slip.
