# Outlets & menu

## Outlets

Each restaurant account can have multiple **outlets** (branches). Switch the active outlet from the top bar in the dashboard.

Per outlet you configure:

- Name, address, GST number, GPS pin on the map
- **Operation mode** — affects POS layout (e.g. self-service counter)
- **Customer ordering link** and QR code — on the **outlet detail page** (see below)
- Printer settings (per outlet or shared via the mobile app)
- Integrations (Swiggy/Zomato where enabled)
- **Shiprocket delivery** — **Settings → Delivery** (one connection per outlet)

Open **Outlets → [outlet name]** (or **Settings → Outlets** → click an outlet) for full outlet settings.

## Customer ordering links & QR codes

Ordering links are managed **inside each outlet**, not on a shared Settings list.

| Link type | Where to find it |
|-----------|------------------|
| **Direct outlet link + QR** | **Outlets → [outlet name]** → **Customer Ordering Link** |
| **Brand ordering page** (all outlets, GPS distance) | **Settings → Branding** → Brand ordering page |

Each direct link looks like `https://yoursite.com/r/<outlet-id>`. Share the URL or print the QR from the outlet detail screen.

**Tip:** Pin the outlet on the map (Edit → Pin on map) so customers on the brand page see distance to your branch.

## Customer ordering portal

Customers who open your **direct outlet link** or brand ordering page can browse the menu, add items, and use **Place Order** on the menu screen to go straight to checkout (they can still open **Cart** from the bottom bar to review items first).

For **delivery** orders, checkout requires address plus **pincode**, **city**, and **state** (needed for Shiprocket booking). See [Shiprocket delivery](/docs/shiprocket-delivery).

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
- [Shiprocket delivery](/docs/shiprocket-delivery)
