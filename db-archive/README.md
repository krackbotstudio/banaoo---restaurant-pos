# db-archive/

Historical SQL snapshots and one-off database utility scripts that used to live in the repo root.

**Nothing in this folder is wired into the running app or the deploy pipeline.** It's kept for reference, debugging old migrations, and re-running occasional maintenance.

---

## What lives here

### SQL snapshots

| File | What |
|---|---|
| `16-04-2026.sql` | Full schema dump from 16 April 2026 (~150 KB). Use as a reference baseline. |
| `19-april.sql` | Delta against the 16 April snapshot — adds order/menu/outlet columns introduced on 19 April. |
| `20-april.sql` | Adds the `public.mobile_app_leads` table for landing-page APK download requests. |

### One-off SQL utilities

| File | What |
|---|---|
| `update_trigger.sql` | Latest version of the `public.handle_new_user()` trigger. Apply with `apply_sql.js`. |
| `sync_existing_staff.sql` | Back-fills `public.users` and `public.profiles` rows for staff members that pre-date the auth migration. Apply with `apply_sync.js`. |

### One-off helper scripts

All scripts connect via [`server/db.js`](../server/db.js) (which reads `DATABASE_URL` from `.env`). Run them from the **repo root**:

```bash
node db-archive/apply_sql.js          # re-applies update_trigger.sql
node db-archive/apply_sync.js         # re-runs sync_existing_staff.sql
node db-archive/check-db.js           # prints schema info for staff_* tables
node db-archive/check-rls.js          # prints RLS state for sensitive tables
node db-archive/check-staff-login.js  # lists recent staff + verifies users sync
```

> ⚠️ These scripts mutate production data when pointed at production. Always check what `DATABASE_URL` is set to before running.

---

## What you should use instead for new work

| Need | Use |
|---|---|
| Add a new schema change | Create a timestamped migration in [`supabase/migrations/`](../supabase/migrations/) |
| Apply a migration manually | [`server/scripts/apply-migration.js`](../server/scripts/apply-migration.js) |
| Schema for the staff/auth migration system | See `CHANGELOG-TEAM.md` in [`docs/`](../docs/) |

If a file in this folder is no longer useful, delete it — nothing imports from `db-archive/` outside of itself.
