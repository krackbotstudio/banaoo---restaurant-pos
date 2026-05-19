/**
 * Grant internal test subscription (enterprise / Expand) to krackbotstudio@gmail.com
 *
 * Usage (from repo root, with DATABASE_URL in .env or environment):
 *   node server/scripts/grant-test-subscription.js
 */
import pool from '../db.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const TEST_EMAIL = 'krackbotstudio@gmail.com';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath = join(__dirname, '../../supabase/migrations/20260515000002_grant_test_account_enterprise.sql');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or export it, then retry.');
    process.exit(1);
  }

  const sql = readFileSync(sqlPath, 'utf8');

  const { rows: before } = await pool.query(
    `SELECT u.id, u.email, p.account_status, s.plan_type, s.status, s.expires_at
     FROM public.users u
     LEFT JOIN public.profiles p ON p.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT plan_type, status, expires_at
       FROM public.subscriptions
       WHERE user_id = u.id AND status IN ('active', 'trialing', 'past_due')
       ORDER BY created_at DESC
       LIMIT 1
     ) s ON true
     WHERE LOWER(u.email) = LOWER($1)`,
    [TEST_EMAIL]
  );

  if (before.length === 0) {
    console.error(`No user found for ${TEST_EMAIL}. Sign in once so public.users has a row, then retry.`);
    process.exit(1);
  }

  console.log('Before:', before[0]);

  await pool.query(sql);

  const { rows: after } = await pool.query(
    `SELECT u.id, u.email, p.account_status, s.plan_type, s.status, s.expires_at
     FROM public.users u
     LEFT JOIN public.profiles p ON p.user_id = u.id
     LEFT JOIN LATERAL (
       SELECT plan_type, status, expires_at
       FROM public.subscriptions
       WHERE user_id = u.id AND status IN ('active', 'trialing', 'past_due')
       ORDER BY created_at DESC
       LIMIT 1
     ) s ON true
     WHERE LOWER(u.email) = LOWER($1)`,
    [TEST_EMAIL]
  );

  console.log('After:', after[0]);
  console.log('Done — enterprise (Expand) active for 10 years.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
