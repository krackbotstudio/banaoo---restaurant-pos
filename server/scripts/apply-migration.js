/**
 * Apply one or more SQL migration files to the database in DATABASE_URL.
 *
 * Usage (from repo root):
 *   node server/scripts/apply-migration.js supabase/migrations/<file>.sql [more.sql ...]
 *
 * Each file runs inside its own transaction. The script is idempotent for
 * migrations that use IF NOT EXISTS / IF EXISTS / OR REPLACE patterns
 * (which the supabase/migrations/* files already do).
 */
import pool from '../db.js';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

async function applyOne(file) {
  const abs = resolve(file);
  if (!existsSync(abs)) {
    throw new Error(`Migration file not found: ${abs}`);
  }
  const sql = readFileSync(abs, 'utf8');
  console.log(`\n→ Applying ${file}`);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`  ✓ Applied`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Add it to .env or export it, then retry.');
    process.exit(1);
  }

  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('No migration files passed. Example:');
    console.error('  node server/scripts/apply-migration.js supabase/migrations/20260521000001_customer_upi_payments.sql');
    process.exit(1);
  }

  for (const file of files) {
    await applyOne(file);
  }

  console.log('\nAll migrations applied.');
}

main()
  .catch((err) => {
    console.error('\nMigration failed:', err.message);
    process.exit(1);
  })
  .finally(() => pool.end());
