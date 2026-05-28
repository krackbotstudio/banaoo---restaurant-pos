# docs/

Internal project documentation — architectural references, engineering notes, operational logs, marketing collateral plans, and team-facing changelogs. **Not** the same as end-user-facing documentation (those markdown sources live under [`../src/content/docs/`](../src/content/docs/) and are rendered by the `/docs/*` pages of the web app).

---

## Index

### Reference (read these first)

| File | What |
|---|---|
| [`techstack.md`](techstack.md) | High-level inventory of every technology, library, and service used across web, backend, mobile, and the data layer. Start here. |
| [`backend.md`](backend.md) | Map of the Node/Express service (`server/`) — bootstrap, auth model, Razorpay, entitlements, customer ordering, AI integrations, scripts. |
| [`frontend.md`](frontend.md) | Map of the web app (`src/`) — provider stack, routes, key flows, UI library, hooks, libs, SEO, theming. |
| [`mobile-app.md`](mobile-app.md) | The Expo/React Native shell (`mobile/`) — WebView bridge protocol, printer subsystem, release pipeline, quirks. |
| [`api.md`](api.md) | Complete grouped reference of every HTTP endpoint — method, path, purpose, auth requirement, request/response shape. |

### Operational / historical

| File | What |
|---|---|
| [`CHANGELOG.md`](CHANGELOG.md) | Living team changelog and backend hand-off doc. Update whenever frontend/backend/mobile/DB/deploy ships a change. |
| [`DEV-LOG.md`](DEV-LOG.md) | Free-form developer log — useful as a session-by-session notebook (Android APK builds, splash screens, printer parity, etc.). |
| [`SEO.md`](SEO.md) | Full SEO implementation guide — what's wired up, how to use the `<SEO>` component, follow-up actions, and what unlocks rich SERPs. |
| [`demo-guide-videos.md`](demo-guide-videos.md) | List of "How-to" demo video scenarios planned for YouTube + in-app help. |

### Plans & proposals

Design documents for features that aren't built yet. Each one has a "DECISIONS — please pick" callout at the top; lock those decisions before opening the first PR.

| File | What | Status |
|---|---|---|
| [`wallet-system-plan.md`](wallet-system-plan.md) | Online Order Wallet & Integration Management System — prepaid credit ledger that meters Swiggy/Zomato (and future) syncs, with admin pricing/packages/refunds. | Proposed — awaiting product decisions |
| [`admin-cms.md`](admin-cms.md) | Tectangle Admin CMS — separate `/cms` panel for platform operators (customers, subscriptions, payments, roles). | Phase 1 shipped — see doc for roadmap |

---

## Reading order for new joiners

1. **[`techstack.md`](techstack.md)** — get oriented on what libraries and services we use.
2. **[`backend.md`](backend.md)** — understand the API server (auth, billing, business logic).
3. **[`frontend.md`](frontend.md)** — understand the web app (routes, providers, key flows).
4. **[`api.md`](api.md)** — bookmark this; you'll return to it constantly.
5. **[`mobile-app.md`](mobile-app.md)** — only when you touch printing or mobile-specific flows.
6. **[`CHANGELOG.md`](CHANGELOG.md)** — last 10 entries are usually enough to catch up on recent work.

## When to update which file

| Doing this... | Update this |
|---|---|
| Shipping any user-visible feature | `CHANGELOG.md` |
| Adding/changing an HTTP endpoint | `api.md` (always) + `backend.md` if the auth or domain model changes |
| Adding a route, hook, or provider on the web | `frontend.md` |
| Changing the mobile bridge or printer code | `mobile-app.md` |
| Adopting a new dependency | `techstack.md` |
| Working late and want to remember why you did something | `DEV-LOG.md` |
| Changing SEO meta / structured data / sitemap | `SEO.md` |
| Planning marketing video content | `demo-guide-videos.md` |
| Proposing a feature that doesn't exist yet | Add a new file under "Plans & proposals" (see `wallet-system-plan.md` for the format) |
| Shipping or extending the Tectangle CMS | `admin-cms.md` (always) + `api.md` + `CHANGELOG.md` |

For schema/SQL history (legacy snapshots, one-off DB scripts), see [`../db-archive/`](../db-archive/).

---

## Conventions

- These are **internal** docs. Don't mirror them into the public web app — that's what `src/content/docs/` is for.
- Use relative links between files (e.g. `[backend.md](backend.md)`) so they work on GitHub *and* in any future doc renderer.
- Keep file names lowercase-kebab (`mobile-app.md`) except for the established uppercase ones (`README.md`, `CHANGELOG.md`, `DEV-LOG.md`, `SEO.md`).
- When you bump a major design decision (e.g. removing the 1-month plan, switching auth providers, changing the printer transport), update **both** the affected reference doc *and* `CHANGELOG.md` in the same PR.
