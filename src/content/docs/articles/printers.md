# Printers

Flaze supports thermal receipt printers for **kitchen tickets (KOT)** and **billing**. You can manage multiple printers per outlet (**printer fleet**) or use legacy kitchen/billing roles.

## Where to configure

| Location | Purpose |
|----------|---------|
| **Settings → Printers** (web) | Fleet: add printers, types, categories, auto-print, test print |
| **Native printer settings** (Android app) | Bluetooth classic/BLE, LAN IP, per-outlet or global fallback |

Open native settings from the app menu or when the web UI prompts you on APK.

## Printer types (fleet)

| Type | Prints |
|------|--------|
| Kitchen | KOT / kitchen order slips |
| Billing | Customer bills, handoff slips in self-service |
| Customer token | Short summary slips (if enabled) |

Assign **categories** to route menu items to specific kitchen printers when using multiple kitchen stations.

## Connection methods

- **USB / Web Serial** — desktop Chrome with compatible ESC/POS printer.
- **Bluetooth** — via **Flaze Android app** (pair in system Bluetooth, then select device in native settings).
- **LAN / Wi‑Fi** — printer IP and port (usually 9100) in native settings.

## Test print

1. **Web fleet** — **Test print** on a printer row (uses native test on APK, USB serial on desktop).
2. **Native settings** — **Test print** for kitchen and billing roles independently.

If test print works but orders do not, check **auto print**, printer **enabled** state, and correct **outlet** selected in the app.

## Self-service printing

For self-service outlets, billing printer settings include:

- **Print on order** — auto-print after placing order
- **Bill with kitchen handoff** — second slip with items for kitchen pickup
- **Kitchen station copy** — optional third print to kitchen printer

Customer copy prints first; after a short pause, the handoff slip prints and cuts separately.

## Outlet vs global (mobile app)

Printer config is stored per outlet. If an outlet has no working connection, the app **falls back to global** native printer settings so one paired printer can serve all outlets on a device.

## Common issues

| Symptom | What to check |
|---------|----------------|
| “Sent” but no paper | Use latest web + APK; ensure test print works; see [FAQ](/docs/faq-troubleshooting) |
| Only customer bill, no kitchen | Enable handoff toggle; add a **kitchen** fleet printer or native kitchen role |
| Fleet test fails on phone | Use native test; USB serial does not work on APK for LAN/BT |
| Wrong outlet | Select correct outlet in app before native settings |

## Related

- [Mobile app](/docs/mobile-app)
- [Billing & receipts](/docs/billing-and-receipts)
