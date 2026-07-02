# Shiprocket Quick — food delivery integration

Per-outlet **Shiprocket Quick** hyperlocal **2-wheeler** booking for Banaoo-native food delivery orders. Uses `SR_QUICK` + hyperlocal serviceability + AWB assign. Credentials are stored **server-side only** (AES-encrypted).

**Public guide:** [`../src/content/docs/articles/shiprocket-delivery.md`](../src/content/docs/articles/shiprocket-delivery.md) (rendered at `/docs/shiprocket-delivery`).

---

## Prerequisites

- Expand plan **or** free `shiprocket_delivery` add-on (₹0 — activates without Razorpay)
- Shiprocket Quick enabled in your city + API user
- Outlet GPS (`outlets.latitude/longitude`) or pickup lat/lng in settings
- Customer delivery pin at checkout (`orders.delivery_latitude/longitude`)
- Structured address: `delivery_pincode`, `delivery_city`, `delivery_state`

---

## Create API credentials (required)

Shiprocket does **not** accept your main panel login. You need a separate API user:

1. Log in at [app.shiprocket.in](https://app.shiprocket.in)
2. **Settings → API → Add New API User**
3. Email must be **different** from your registered Shiprocket email
4. Modules: **Orders (create, update)**, **Shipments** (minimum)
5. Paste API email + password in Banaoo **Settings → Delivery → Connect Shiprocket**

---

## Owner setup (UI)

| Step | Location |
|------|----------|
| Enable add-on | **Add-ons** → Shiprocket delivery → **Activate free** |
| Connect account | **Settings → Delivery → Shiprocket** → Connect |
| Pickup & package | Same panel → Delivery settings → Save |
| Webhook | Copy URL from connect panel → Shiprocket webhook config |
| Per-outlet | One Shiprocket connection **per outlet** |

Brand/multi-outlet ordering links are documented in [outlets-and-menu](../src/content/docs/articles/outlets-and-menu.md). Direct outlet links live on **Outlets → [outlet] → Customer Ordering Link**.

---

## Usage workflow

```text
Customer POST /api/public/customer-orders (order_type=delivery)
  → orders.status = pending

Restaurant marks Preparing (Orders UI → Supabase update + POST schedule)
  → shiprocket_shipments row, status=booking
  → booking_scheduled_at = now + prep_time_minutes

Job runner (30s tick)
  → hyperlocal serviceability → create/adhoc (SR_QUICK) → assign AWB → 2-wheeler rider

Shiprocket webhook OR poll fallback
  → shiprocket_tracking_events, orders.delivery_status

Customer GET /api/public/orders/:id/delivery-status?phone=
```

**Excluded:** `orders.source` in `swiggy`, `zomato`.

---

## Status mapping

| `shiprocket_shipments.status` | Customer label |
|-------------------------------|----------------|
| `not_booked` | Order accepted |
| `booking` | Preparing your food |
| `shipment_created` / `awaiting_rider` | Finding rider |
| `rider_assigned` | Rider assigned |
| `picked_up` | Food picked up |
| `out_for_delivery` | On the way |
| `delivered` | Delivered |
| `booking_failed` | Delivery booking failed |
| `cancelled` | Cancelled |

---

## API (owner session)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/outlets/:outletId/shiprocket` | Connection + settings (no secrets) |
| POST | `/api/outlets/:outletId/shiprocket/connect` | Validate login, encrypt store |
| POST | `/api/outlets/:outletId/shiprocket/disconnect` | Clear tokens |
| PATCH | `/api/outlets/:outletId/shiprocket/settings` | Prep time, weight, pickup, COD, auto toggle |
| GET | `/api/orders/:orderId/shiprocket` | Shipment + timeline |
| POST | `/api/orders/:orderId/shiprocket/retry` | Manual retry |
| POST | `/api/orders/:orderId/shiprocket/cancel` | Cancel shipment |
| POST | `/api/orders/:orderId/shiprocket/schedule` | Schedule booking (called when → Preparing) |
| PATCH | `/api/orders/:orderId/status` | Status change + hook (optional central path) |
| GET | `/api/dashboard/delivery-overview?outlet_id=` | Dashboard KPI cards |

### Public / webhook

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/webhooks/shiprocket?outlet_id=` | Tracking updates; optional `x-api-key` |
| GET | `/api/public/orders/:orderId/delivery-status?phone=` | Customer polling |

---

## Server modules (`server/shiprocket/`)

| File | Role |
|------|------|
| `client.js` | HTTP to `apiv2.shiprocket.in` (login, adhoc SR_QUICK, hyperlocal serviceability, assign AWB, track, cancel) |
| `hyperlocal.js` | Quick courier selection helpers |
| `auth.js` | Credential storage, token cache/refresh |
| `crypto.js` | AES-256-GCM at rest |
| `delivery-service.js` | Schedule, book, retry, cancel, sync tracking |
| `status-mapper.js` | Webhook codes → Banaoo statuses |
| `webhook.js` | Webhook + public delivery-status |
| `jobs.js` | 30s interval: due bookings, retries, poll, token refresh |
| `routes.js` | Express routes |
| `audit.js` | `shiprocket_audit_log` |

Registered in `server/index.js` via `registerShiprocketRoutes()` and `startShiprocketJobs()`.

---

## Entitlements

- `shiprocketDelivery` on Expand by default
- Add-on `shiprocket_delivery` — **free** (`ADDON_MONTHLY_PRICES.shiprocket_delivery = 0`)
- Free add-ons skip Razorpay in `POST /api/payments/create-addon-order` when amount is ₹0

---

## Environment

| Variable | Purpose |
|----------|---------|
| `SHIPROCKET_ENCRYPTION_KEY` | Credential encryption (falls back to `SESSION_SECRET`) |

---

## Database

Migration: `supabase/migrations/20260611000001_shiprocket_delivery.sql`

| Table | Purpose |
|-------|---------|
| `shiprocket_connections` | Per-outlet encrypted credentials + settings JSONB |
| `shiprocket_shipments` | One row per delivery order |
| `shiprocket_tracking_events` | Timeline events |
| `shiprocket_audit_log` | connect / book / webhook / fail |

`orders` columns: `delivery_pincode`, `delivery_city`, `delivery_state`, `delivery_status`.

RLS enabled, **no client policies** (server pool only).

---

## Tests

```bash
node --test server/shiprocket/status-mapper.test.js
```

---

## v1 limitations

- In-process job runner (single API instance recommended; `FOR UPDATE` on booking rows)
- Manual QA with Shiprocket sandbox before production
- Orders status still updated via Supabase from UI; Shiprocket schedule triggered by follow-up API call

---

## Related internal docs

- [`api.md`](api.md) — HTTP reference (Shiprocket section)
- [`backend.md`](backend.md) — server map
- [`CHANGELOG.md`](CHANGELOG.md) — release history
