/**
 * Create the first CMS admin user in public.admin_users.
 *
 * Usage (from repo root):
 *   node server/scripts/seed-cms-admin.js admin@tectangle.com "YourSecurePassword" "Admin Name"
 *
 * Requires DATABASE_URL in server/.env or environment.
 */
import bcrypt from 'bcryptjs';
import pool from '../db.js';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  const fullName = process.argv[4] || 'CMS Admin';

  if (!email || !password) {
    console.error('Usage: node server/scripts/seed-cms-admin.js <email> <password> [full_name]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO public.admin_users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'super_admin')
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       full_name = EXCLUDED.full_name,
       role = 'super_admin',
       is_active = true,
       updated_at = now()
     RETURNING id, email, role`,
    [email.toLowerCase(), hash, fullName]
  );

  console.log('CMS admin ready:', rows[0]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());
