# Mobile app (Android)

The **Banaoo Android app** wraps the same POS web app (`banaoo.in`) and adds native **Bluetooth** and **LAN** printing.

## Install

1. Download the latest APK from your deployment (e.g. **banaoo-latest.apk** on your site’s downloads path).
2. Allow **Install unknown apps** for your browser or file manager if prompted.
3. Open the app and sign in with your restaurant account.

Keep the app updated when your team ships printer or POS fixes — old APK + new web (or the reverse) can cause print timeouts.

## Permissions

The app may request:

- **Bluetooth** — discover and connect to paired printers
- **Location** (Android 12+) — required by Android for Bluetooth scan
- **Internet** — load POS and sync orders

Grant permissions when asked; printing fails without Bluetooth access on many devices.

## Native printer settings

From the app (or **Open native printer settings** on the web when inside the APK):

1. Select **outlet** (or use global defaults).
2. Configure **Kitchen** and **Billing** roles: transport, device/IP, paper width, feed lines.
3. Run **Test print** for each role before taking live orders.

Settings sync with print jobs sent from the web POS inside the WebView.

## Using POS in the app

- Full dashboard: orders, kitchen, menu, settings (same as desktop).
- Prefer landscape on tablets for counter use.
- Printer-heavy workflows should use the app rather than mobile browser alone.

## Deploy notes for owners

- Web app must be deployed to the same URL configured in the app (`banaoo.in`).
- APK and web should be updated together when print bridge changes.

## Related

- [Printers](/docs/printers)
- [FAQ & troubleshooting](/docs/faq-troubleshooting)
