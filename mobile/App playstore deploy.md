# Banaoo Android — Google Play Store deployment guide

This document covers everything needed to publish **Banaoo** (`com.banaoo.pos`) on Google Play, including required files, build steps, store listing, and code changes made for Play readiness.

**Current release baseline:** version **0.6** (`versionCode` **8**)

---

## 1. What you need before starting

| Requirement | Details |
|-------------|---------|
| **Google Play Console** | [play.google.com/console](https://play.google.com/console) — one-time **$25** developer registration |
| **Expo / EAS account** | Same owner as `app.json` → `owner: krackbotstudio` |
| **EAS project** | Linked (`extra.eas.projectId` in `app.json`) |
| **Privacy policy URL** | **https://banaoo.in/privacy** (live on your site) |
| **Terms URL** | **https://banaoo.in/terms** |
| **Support email** | e.g. `support@banaoo.in` (used in Play Console) |
| **App signing** | Handled by **EAS** (recommended) — do not ship Play builds signed with the debug keystore |

---

## 2. Required files & folders (checklist)

### In this repo (`mobile/`)

| Path | Purpose |
|------|---------|
| `app.json` | Expo config: version, package, permissions, icons |
| `eas.json` | EAS build profiles (`production` → **AAB** for Play) |
| `.env.example` | Template for `EXPO_PUBLIC_*` production URLs |
| `assets/icon.png` | App icon master |
| `assets/adaptive-icon.png` | Android adaptive foreground |
| `assets/splash.png` | Splash image |
| `store-assets/` | **You add** Play Console graphics (screenshots, feature graphic) |
| `store-assets/store-listing-en.txt` | Copy-paste titles & descriptions |
| `play-store/service-account.json` | **You add** — Google Play API key for `eas submit` (gitignored) |
| `play-store/service-account.json.example` | Template only |
| `scripts/build-play-aab.ps1` | Builds signed `.aab` via EAS |
| `build-play-store.cmd` | Windows shortcut for the script above |

### Generated at build time (do not commit)

| Path | Notes |
|------|--------|
| `android/` | Created by `expo prebuild` / EAS — listed in `.gitignore` |
| `*.jks` / `*.keystore` | Signing keys — **never commit** |

### Play Console uploads (not in git)

| Asset | Spec |
|-------|------|
| **App bundle (.aab)** | From EAS production build |
| **App icon** | 512×512 PNG |
| **Feature graphic** | 1024×500 |
| **Phone screenshots** | Min. 2, portrait 1080×1920 or higher |
| **Data safety form** | Completed in Play Console (see §7) |
| **Content rating** | IARC questionnaire in Play Console |

See `store-assets/README.md` for graphic file names and sizes.

---

## 3. Code & config changes (Play readiness)

### 3.1 `eas.json`

- **`production`** profile uses `"buildType": "app-bundle"` (Google Play requires **AAB**, not APK).
- **`preview`** profile still builds **APK** for internal/sideload testing.
- **`submit.production`** targets Play **internal** track as **draft** (safe first upload).
- **`appVersionSource": "local"`** — version comes from `app.json` / `android.versionCode`.

### 3.2 `app.json`

| Change | Reason |
|--------|--------|
| Display name **Banaoo** | Shorter store-friendly name |
| Added **`description`** | Expo / store metadata |
| **`android.versionCode`: 8** | Must increase every Play upload |
| **`android.version` / `version`: 0.6** | User-visible semver |
| Trimmed Bluetooth permissions | Play policy: request only what you use |
| **`blockedPermissions`** | Blocks camera, mic, background location, legacy `BLUETOOTH_ADMIN` |
| Package unchanged: **`com.banaoo.pos`** | Do not change after first Play upload |

### 3.3 `src/lib/app-version.ts` + `PwaShellScreen.tsx`

- App version in the WebView user-agent (`BanaooApp/0.6`) is read from **`expo-constants`** instead of a hardcoded string.
- Bump **`app.json` → `version`** when releasing; UA updates automatically after rebuild.

### 3.4 `package.json` scripts

| Script | Command |
|--------|---------|
| `npm run build:aab` | EAS production **AAB** (Play Store) |
| `npm run build:apk` | EAS preview **APK** (internal testing) |
| `npm run submit:play` | Upload latest AAB to Play (needs service account) |

### 3.5 Local APK vs Play Store

| Method | Output | Use case |
|--------|--------|----------|
| `scripts/build-release-apk.ps1` | `banaoo-app-v0.6.apk` | Website download, sideload, QA |
| `build-play-store.cmd` / EAS production | `.aab` | **Google Play only** |

**Important:** Local Gradle release builds still use the **debug keystore** in `android/app/build.gradle`. That is OK for sideload/website only. **Play uploads must use EAS**, which applies a proper upload key.

---

## 4. Environment setup

1. Copy env template:
   ```bash
   cd mobile
   copy .env.example .env
   ```
2. Set production values:
   ```env
   EXPO_PUBLIC_API_URL=https://banaoo.in
   EXPO_PUBLIC_WEBAPP_URL=https://banaoo.in
   EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
   ```
3. Log in to EAS (once per machine):
   ```bash
   npx eas-cli login
   npx eas-cli whoami
   ```
4. Optional CI token: set `EXPO_TOKEN` in `.env` or CI secrets.

---

## 5. Version bump checklist (each release)

Update **all** of these before building:

1. `app.json` → `"version": "0.7"` (example)
2. `app.json` → `"android": { "versionCode": 9 }` (**must be higher than last Play upload**)
3. If you use a committed `android/` folder locally, sync `android/app/build.gradle` `versionCode` / `versionName` via:
   ```bash
   npx expo prebuild --platform android
   ```
4. Run `npm run icons:generate` only if icon artwork changed.

---

## 6. Build the Play Store bundle (AAB)

### Option A — Windows

```bat
cd mobile
build-play-store.cmd
```

### Option B — npm

```bash
cd mobile
npm run build:aab
```

### After the build

1. Open the build URL from the CLI, or run:
   ```bash
   npx eas-cli build:list --platform android
   ```
2. Download the **`.aab`** artifact.
3. Keep the build ID for submission.

### First-time signing

On the first EAS production build, EAS will offer to create an **Android Keystore** (upload key). Accept and let EAS store credentials, or provide your own keystore when prompted. **Back up credentials** from Expo dashboard → Project → Credentials.

---

## 7. Play Console setup

### 7.1 Create the app

1. Play Console → **Create app**
2. Name: **Banaoo** (or full listing title from `store-assets/store-listing-en.txt`)
3. Default language: English
4. App / game: **App**
5. Free or paid: **Free** (subscriptions are handled on the web via Banaoo accounts)

### 7.2 Store listing

Use text from `store-assets/store-listing-en.txt`.

Upload graphics from `store-assets/` (see README there).

**Category suggestion:** Business or Food & Drink

### 7.3 App content

| Section | Guidance |
|---------|----------|
| **Privacy policy** | `https://banaoo.in/privacy` |
| **Ads** | No (unless you add ad SDKs later) |
| **App access** | Restricted — login required (provide test credentials for reviewers) |
| **Content rating** | Complete IARC — expect low maturity (business app) |
| **Target audience** | 18+ / not designed for children |
| **News app** | No |
| **COVID / health** | No |
| **Data safety** | See §7.4 |

### 7.4 Data safety (summary for the form)

Declare honestly based on the app behavior:

| Data type | Collected? | Purpose |
|-----------|------------|---------|
| Email, name, phone | Yes | Account, support, APK lead form on website |
| App activity / orders | Yes | Core POS functionality |
| Device IDs | Optional | Crash/analytics if you add them later |
| Location | **Approximate / precise** | Only if BLE scan requires it on older Android — declare **Bluetooth** feature, justify printer pairing |
| Data encrypted in transit | Yes (HTTPS) |
| Users can request deletion | Yes (per privacy policy) |

The app uses a **WebView** to `banaoo.in`; web cookies/session may apply — align answers with your web privacy policy.

### 7.5 Permissions declaration (Bluetooth)

The app uses **Bluetooth** to connect to ESC/POS thermal printers.

In Play Console → **App content** → **Sensitive permissions**:

- **BLUETOOTH_CONNECT / BLUETOOTH_SCAN** — core functionality for receipt printing
- **ACCESS_FINE_LOCATION** — may appear because of Android BLE APIs on some OS versions; declare use for **nearby device discovery** for printers, not for tracking user location

Video: optional short screen recording showing **Printers → Scan → Print test** helps approval.

### 7.6 Reviewer access

Provide a **demo account** (email + password) that reaches the POS dashboard, or a video link. Google must log in because the app requires authentication.

---

## 8. Upload & release

### Manual upload

1. Play Console → your app → **Testing** or **Production** → **Create new release**
2. Upload the `.aab` from EAS
3. Add release notes (example):
   ```
   - Initial Play Store release
   - POS, kitchen, and Bluetooth printing
   - Version 0.6
   ```
4. Start with **Internal testing** → then **Closed** → **Open** → **Production**

### Automated submit (EAS)

1. Create a Google Cloud **service account** with Play Console API access.
2. Download JSON key → save as `mobile/play-store/service-account.json` (gitignored).
3. In Play Console → **Users and permissions** → invite the service account email with **Release to production** (or testing) rights.
4. Submit:
   ```bash
   cd mobile
   npm run submit:play
   ```
   Or with explicit path in `eas.json` (already configured to use `./play-store/service-account.json` when present).

Update `eas.json` → `submit.production.android.track` to `production` when ready for live.

---

## 9. Testing tracks (recommended order)

1. **Internal testing** — up to 100 testers, fast rollout
2. **Closed testing** — selected restaurants
3. **Open testing** — optional public beta
4. **Production** — full listing; update website copy from “APK download” to Play Store link when live

---

## 10. After Play approval

1. Copy the Play Store URL into:
   - Website landing page (replace direct APK CTA if desired)
   - `app.json` → `android.playStoreUrl` (optional, for in-app linking)
2. Keep `public/downloads/banaoo-latest.apk` only if you still want direct APK for enterprise sideload.
3. Set server env `ANDROID_APK_URL` only if you override the default API download path.

---

## 11. Troubleshooting

| Issue | Fix |
|-------|-----|
| EAS “not logged in” | `npx eas-cli login` or set `EXPO_TOKEN` |
| `versionCode` already used | Increment `app.json` `android.versionCode` |
| Play rejects debug-signed build | Use EAS **production** AAB, not local `assembleRelease` |
| BLE permission rejection | Add declaration video + accurate Data safety |
| WebView blank on review device | Ensure `EXPO_PUBLIC_WEBAPP_URL` is production HTTPS |
| 404 on `/downloads/*.apk` on website | Use `/api/mobile-app/apk` or redeploy backend with APK in image |

---

## 12. File tree (quick reference)

```
mobile/
├── App playstore deploy.md          ← this file
├── app.json                         ← version, permissions, package
├── eas.json                         ← AAB production + submit profile
├── .env.example
├── build-play-store.cmd
├── package.json                     ← build:aab, submit:play
├── assets/                          ← icon, splash, adaptive icon
├── store-assets/
│   ├── README.md
│   ├── store-listing-en.txt
│   └── (add screenshots & feature graphic here)
├── play-store/
│   ├── .gitignore
│   ├── service-account.json         ← you create (secret)
│   └── service-account.json.example
├── scripts/
│   ├── build-play-aab.ps1
│   └── build-release-apk.ps1        ← sideload APK only
└── src/lib/app-version.ts           ← shared version constant
```

---

## 13. Changelog (Play prep — May 2026)

| Date | Change |
|------|--------|
| 2026-05 | Added Play Store deploy guide and `store-assets/` templates |
| 2026-05 | `eas.json`: production → `app-bundle`; submit profile for internal track |
| 2026-05 | `app.json`: versionCode 8, v0.6, trimmed/blocked permissions, store description |
| 2026-05 | `app-version.ts`: dynamic version in WebView UA |
| 2026-05 | Scripts: `build-play-aab.ps1`, `build-play-store.cmd`, npm `build:aab` / `submit:play` |
| 2026-05 | `.env.example` and `play-store/` secrets layout |

---

**Next step:** Add screenshots to `store-assets/`, run `build-play-store.cmd`, complete Play Console forms, upload AAB to **Internal testing**.
