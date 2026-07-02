# Shiprocket Quick — food delivery

Banaoo books **Shiprocket Quick** hyperlocal **2-wheeler** riders for **your own** restaurant food delivery orders (customer ordering link and POS). National surface/air couriers are not used. Swiggy and Zomato aggregator orders are **not** sent to Shiprocket.

## Before you start

| Requirement | Where |
|-------------|--------|
| **Customer ordering** add-on, Growth plan, or Expand plan | [Add-ons](/addons) — Shiprocket delivery add-on is **free** to activate |
| **Shiprocket Quick** enabled in your city | [Shiprocket Quick](https://www.shiprocket.in/quick/) |
| **Dedicated API user** (not your main login) | Shiprocket → Settings → API → Create API user |
| **Restaurant GPS** on outlet map | Outlets → outlet detail → location |
| **Customer delivery pin** at checkout | Map + pincode, city, state |
| **Pickup address + pincode** | Banaoo → Settings → Delivery → Shiprocket Quick |

## Enable the feature

1. Go to **Add-ons** and click **Activate free** on **Shiprocket delivery** (or use Expand plan).
2. Open **Settings → Delivery → Shiprocket Quick** for the outlet you want to connect.
3. Click **Connect Shiprocket** and enter your **API user** email and password.

### Create a Shiprocket API user

1. Log in to [app.shiprocket.in](https://app.shiprocket.in).
2. **Settings → API → Add New API User**.
3. Use an email **different** from your registered Shiprocket account email.
4. Under **Modules to access**, enable at least **Orders (create, update)** and **Shipments**.
5. Click **Create User** and note the API password (Shiprocket may email it to your main account).

> **Common mistake:** Using your main Shiprocket login in Banaoo returns *Invalid email and password combination*. Always use the API user credentials.

## Configure delivery settings

On **Settings → Delivery → Shiprocket Quick**:

| Setting | Purpose |
|---------|---------|
| **Auto-book Quick rider** | When on, Banaoo books a 2-wheeler after you mark a delivery order **Preparing** |
| **Prep time (minutes)** | Delay before booking (time to prepare food before rider pickup) |
| **Food package weight** | Weight sent to Shiprocket Quick (max 5 kg) |
| **Pickup address + pincode** | Restaurant pickup for the courier |
| **Pickup GPS** | Uses outlet map location, or override lat/lng here |
| **Pickup location name** | Nickname in Shiprocket (e.g. `Primary`) |
| **Allow COD shipments** | Use COD on Shiprocket when customer pays at counter |
| **Webhook URL** | Copy into Shiprocket webhook settings (`?outlet_id=…`) |

Save settings after changes. Credentials are stored **encrypted on the server** — they are never shown again in the browser after connect.

## Daily usage

### 1. Customer places a delivery order

Customers order via your **outlet ordering link** and must set their **delivery pin on the map** (pincode, city, state auto-filled).

### 2. Accept and start preparing

In **Orders**, open the delivery order and move status to **Preparing**. Banaoo schedules Shiprocket booking after your configured prep time.

### 3. Track in Banaoo

- **Orders** — open the order → **Shiprocket Delivery** panel (AWB, courier, timeline, Track / Retry / Cancel).
- **Dashboard** — **Delivery overview** cards (pending booking, out for delivery, delivered today, etc.).
- **Customer** — order confirmation and **Your Orders** show a delivery timeline.

### 4. Status updates

Shiprocket sends webhooks to your copied webhook URL. If a webhook is missed, Banaoo polls Shiprocket every few minutes for in-flight shipments.

## Order detail actions

| Action | When to use |
|--------|-------------|
| **Track** | Open Shiprocket tracking in a new tab |
| **Retry booking** | After a booking failure |
| **Cancel shipment** | Cancel the Shiprocket shipment (order in Banaoo stays active) |

## Discovery shortcut

**Integrations** includes a **Shiprocket Delivery** card that links to **Settings → Delivery** (configuration lives in Settings, not Integrations).

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Connect fails — invalid email/password | Use API user from Shiprocket → Settings → API, not main login |
| No shipment after Preparing | Enable **Auto-book delivery**; confirm outlet is connected; check prep time |
| Booking failed on order | Open order → **Retry booking**; verify pickup address and customer pincode |
| Customer timeline empty | Ensure delivery order has phone; webhook URL set in Shiprocket |
| Feature locked | Activate free Shiprocket add-on or upgrade to Expand |

## Related

- [Outlets & menu](/docs/outlets-and-menu) — ordering links per outlet
- [Orders & POS](/docs/orders-and-pos) — order workflow
- [FAQ & troubleshooting](/docs/faq-troubleshooting)
