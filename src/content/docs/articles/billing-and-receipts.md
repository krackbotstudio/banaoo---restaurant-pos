# Billing & receipts

## Printing a bill

From **Orders**, open an order and use **Print bill** (or complete payment flow where billing prints automatically).

Bills include:

- Restaurant and **outlet** name
- Order number (highlighted)
- Item lines with quantity and amount columns
- Subtotal, discount, service charge, GST breakdown, grand total
- Date and time in a receipt-safe format

## GST & charges

- Per-item **GST rate** on menu items flows into the bill.
- **Discount** can be fixed amount or percent.
- **Service charge** is applied on the taxable amount after discount.

Configure defaults in outlet or order screen as available in your plan.

## Reprints

- **Orders** — reprint bill for a past order when a billing printer is configured.
- **Self-service success dialog** — separate buttons for **customer bill** and **kitchen handoff** reprint.
- Reprint only shows success when the printer actually completes the job (native app reports real status).

## Customer token / quick slip

Some setups print a short **customer token** slip (order summary) on the billing printer — configure under printer settings.

## Browser vs hardware printing

| Method | When |
|--------|------|
| Native Android app | Bluetooth / LAN thermal printers |
| USB serial (web) | Chrome/Edge with supported serial API |
| Browser print dialog | Fallback when no hardware printer is assigned |

Wi‑Fi/LAN on desktop web often requires the **Android app** native printer settings.

## Related

- [Printers](/docs/printers)
- [FAQ & troubleshooting](/docs/faq-troubleshooting)
