// Legacy one-off helper: re-syncs existing staff members into public.users
// via sync_existing_staff.sql. Was needed during the staff-table migration.
// Kept for reference.
//
// Usage (from repo root):
//   node db-archive/apply_sync.js

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';
import pool from '../server/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applySync() {
  try {
    const sql = fs.readFileSync(resolve(__dirname, 'sync_existing_staff.sql'), 'utf8');
    await pool.query(sql);
    console.log('Successfully synced existing staff members to public.users.');
  } catch (err) {
    console.error('Error syncing staff:', err);
  } finally {
    process.exit();
  }
}

applySync();
