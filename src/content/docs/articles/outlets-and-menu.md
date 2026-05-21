# Outlets & menu

## Outlets

Each restaurant account can have multiple **outlets** (branches). Switch the active outlet from the top bar in the dashboard.

Per outlet you configure:

- Name, address, GST number
- **Operation mode** — affects POS layout (e.g. self-service counter)
- **Customer ordering link** and QR code — **Settings → Outlets** or **Outlets → [outlet name]** (not under Profile)
- Printer settings (per outlet or shared via the mobile app)
- Integrations (delivery platforms, where enabled)

Open **Outlets → [outlet name]** for full outlet settings including GPS pin on the map.

## Customer ordering portal

Customers who open your **direct outlet link** or brand ordering page can browse the menu, add items, and use **Place Order** on the menu screen to go straight to checkout (they can still open **Cart** from the bottom bar to review items first).

## Menu structure

| Level | Description |
|-------|-------------|
| Category | Groups items (e.g. Biryani, Drinks) |
| Item | Name, price, GST %, veg/non-veg, availability |
| Modifier / add-on | Optional extras linked to items |

Mark items **unavailable** to hide them from POS without deleting.

## QR & digital menus

- **Tools → QR Menu Builder** — public tool to design a menu and QR code.
- **My Menus** (logged in) — saved menus tied to your account.
- Customer ordering may use `/menu/:slug` or brand links depending on your setup.

## Multi-outlet tips

- Duplicate menu patterns across outlets manually today; keep naming consistent for reporting.
- Printer and self-service toggles are **per outlet** — configure each branch that prints locally.

## Related

- [Getting started](/docs/getting-started)
- [Orders & POS](/docs/orders-and-pos)
