/**
 * Repoint staff_members.owner_id to public.users (Passport auth).
 * Run: node server/scripts/fix-staff-owner-fk.js
 */
import pool from '../db.js';

const SQL = `
ALTER TABLE public.staff_members
  DROP CONSTRAINT IF EXISTS staff_members_owner_id_fkey;

ALTER TABLE public.staff_members
  ADD CONSTRAINT staff_members_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.staff_members DROP CONSTRAINT IF EXISTS staff_members_username_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_members_owner_username
  ON public.staff_members (owner_id, lower(username))
  WHERE username IS NOT NULL;
`;

async function main() {
  await pool.query(SQL);
  console.log('[ok] staff_members.owner_id → public.users');
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
