# Razorpay Payment Gateway Integration

Direct merchant-level payment integration allowing restaurant customers to pay online using cards, UPI, net banking, or wallets during checkout. The integration supports both direct merchant API credentials and OAuth access delegation.

---

## Environment Variables

| Variable | Required in Prod | Purpose |
|:---|:---|:---|
| `RAZORPAY_KEY_ID` | Yes | Platform partner key identifier |
| `RAZORPAY_KEY_SECRET` | Yes | Platform partner secret key |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Key used to verify incoming Webhook signature payloads |
| `RAZORPAY_MODE` / `RAZORPAY_OAUTH_MODE` | No | Integration mode (defaults to `'test'`, set to `'live'` in production) |

---

## DB Tables

| Table Name | Role |
|:---|:---|
| `public.razorpay_connections` | Stores encrypted API credentials, settings, and OAuth access/refresh tokens. |
| `public.checkout_sessions` | Stores temporary client-side cart payloads linked to a specific `gateway_order_id`. |
| `public.order_payments` | Core order transaction logs (stores gateway IDs, statuses, signatures, references). |
| `public.order_refunds` | Detailed ledger of partial and full refunds. |
| `public.razorpay_events` | Webhook audit logs to verify and track all incoming event scopes. |

---

## 1. Webhook Signature Verification

All webhooks received at `POST /api/webhooks/razorpay` must be validated to prevent spoofing:
*   Incoming webhook requests require a valid header signature in `'x-razorpay-signature'`.
*   The raw payload is checked against the configured restaurant connection `webhook_secret` using HMAC-SHA256.
*   If the signature check fails, the request is immediately rejected with **HTTP 400 Bad Request**. If the secret itself is not configured on the restaurant settings profile, the request fails with **HTTP 401 Unauthorized**.

---

## 2. Webhook Event Mappings

Supported event scopes parsed by the webhook handler:

| Webhook Event | Internal Payment Status | Description |
|:---|:---|:---|
| `payment.created` | `'created'` | Customer initiates checkout. |
| `payment.authorized` | `'authorized'` | Bank authenticates payment successfully. |
| `payment.captured` | `'paid'` | Merchant claims funds successfully (marked paid). |
| `payment.failed` | `'failed'` | Payment was rejected by bank or canceled. |
| `order.paid` | `'paid'` | Order fully paid. |
| `refund.created` / `refund.processed` | `'refunded'` / `'partially_refunded'` | Refund processed by Razorpay. |
| `payment.dispute.created` / `payment.dispute.won` / `payment.dispute.lost` | No status change | Logged in connection details and metadata updates. |

---

## 3. Duplicate Webhook Event Protection (Idempotency)

To guard against network duplicate submissions, each incoming webhook checks if the `event_id` exists in the `public.razorpay_events` audit table:
*   If the event was already logged, the server halts execution immediately and returns `{ ok: true, duplicate: true }` with an HTTP 200 to prevent retry storms.

---

## 4. Refund Flow

*   **Endpoint:** `POST /api/orders/:orderId/refunds`
*   **Balance Validation:** The backend checks the sum of existing refund records in `public.order_refunds`. Rejects the request if the refund amount exceeds the remaining unrefunded balance.
*   **API Execution:** Initiates either a full or partial refund using the `/payments/:paymentId/refund` endpoint on Razorpay's API.
*   **Webhook Synchronization:** Razorpay sends `refund.processed` when the funds clear, updating the order and payment records status to `'refunded'` or `'partially_refunded'` automatically.

---

## 5. Security Checklist & Audits

1.  **No Client-Side Verification Trust:** Never accept payment confirmation messages from the client. Payments must be verified via HMAC-SHA256 signature check on the server (`POST /verify-online-payment`) before updating database orders.
2.  **No Client-Side Amount Calculations:** The checkout amount is determined and locked inside `checkout_sessions` on the server when creating the order.
3.  **Secrets Encryption:** Direct merchant credential secrets and OAuth tokens are stored encrypted using AES-256-GCM in the database.
4.  **No Logs Leakage:** Decrypted secrets, passwords, card details, or authentication tokens must never be logged to console stdout or event files.

---

## 6. Testing

### Run Automated Unit Tests
```bash
node --test server/razorpay/*.test.js
```
