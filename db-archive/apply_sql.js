// Legacy one-off helper: re-applies update_trigger.sql against the live DB.
// Kept for reference; review the SQL before running again.
//
// Usage (from repo root):
//   node db-archive/apply_sql.js

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';
import pool from '../server/db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function applySql() {
  try {
    const sql = fs.readFileSync(resolve(__dirname, 'update_trigger.sql'), 'utf8');
    await pool.query(sql);
    console.log('Successfully updated handle_new_user trigger.');
  } catch (err) {
    console.error('Error updating trigger:', err);
  } finally {
    process.exit();
  }
}

applySql();
