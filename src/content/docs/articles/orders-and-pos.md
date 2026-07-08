# Orders & POS

## Order types

| Type | Use case |
|------|----------|
| Dine-in | Table number on ticket and bill |
| Takeaway | Packaged orders; no table |
| Delivery / online | Customer ordering link or aggregator; Shiprocket for native delivery |

## Creating orders

1. Go to **Orders → New order** (or counter home in self-service mode).
2. Select category, tap items, adjust quantity.
3. Apply **discount** (amount or percent) and **service charge** if needed.
4. Submit — order gets an **order number** and flows to **Kitchen**.

## Self-service / counter mode

When the outlet is in **self-service** operation mode:

- Customer bill and kitchen handoff can print as **two separate slips** (customer copy first, then kitchen handoff after a short pause for the cutter).
- Toggle behaviour under **Settings → Printers** (self-service print on order, bill with handoff, optional kitchen station copy).
- After placing an order, use **Reprint customer bill** or **Reprint kitchen slip** on the success dialog if needed.

## Order list & history

- **Orders** — active and recent orders for the outlet.
- **Order history** — completed orders for lookup and reporting.

## Staff workflow

- Cashiers create and settle orders.
- Kitchen staff use the **Kitchen** page (see [Kitchen display](/docs/kitchen)).
- Managers can void items or cancel lines depending on permissions.

## Printing on new orders

Printing depends on printer settings:

- **Fleet printers** (Settings → Printers) with **auto print** and correct type (kitchen / billing).
- **Native Android app** for Bluetooth and LAN when using the APK.

If nothing prints, see [Printers](/docs/printers) and [FAQ](/docs/faq-troubleshooting).

## Customer online orders (UPI)

Customers ordering via your **ordering link** can:

- Pick an **available table** from your floor plan (dine-in).
- Pay **at counter** (cash) or **UPI now** (if configured).

**Owner setup**

1. **Settings → Branding** — default UPI ID, display name, optional QR image URL.
2. **Outlets → [outlet]** — optional per-outlet override under **Customer UPI payments**.
3. **Payments** in the sidebar — confirm UTR submissions; kitchen sees the order only after you confirm UPI.

Razorpay in Banaoo is for **subscriptions and add-ons only**, not customer food orders.

## Native delivery (Shiprocket)

For orders from your **customer ordering link** (not Swiggy/Zomato):

1. Customer chooses **Delivery** at checkout (address, pincode, city, state required).
2. Order appears in **Orders** with type **delivery**.
3. Mark the order **Preparing** when the kitchen accepts it.
4. If **Settings → Delivery → Shiprocket** is connected with **Auto-book delivery** on, Banaoo books a rider after your prep time.
5. Open the order to see **Shiprocket Delivery** — AWB, courier, timeline, Track / Retry / Cancel.
6. **Dashboard** shows delivery overview stats for the active outlet.

Full setup: [Shiprocket delivery](/docs/shiprocket-delivery).

## Related

- [Billing & receipts](/docs/billing-and-receipts)
- [Kitchen display](/docs/kitchen)
- [Shiprocket delivery](/docs/shiprocket-delivery)
- [Outlets & menu](/docs/outlets-and-menu)
