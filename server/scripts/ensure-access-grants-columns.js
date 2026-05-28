/**
 * Ensures profile access grant columns exist (local dev without full migration push).
 * Run: node server/scripts/ensure-access-grants-columns.js
 */
import pool from '../db.js';

const SQL = `
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS complimentary_plan text
    CHECK (complimentary_plan IS NULL OR complimentary_plan IN ('starter', 'professional', 'enterprise')),
  ADD COLUMN IF NOT EXISTS complimentary_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS feature_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
`;

async function main() {
  await pool.query(SQL);
  console.log('[ok] profile access grant columns ready');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
