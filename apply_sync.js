import pool from './server/db.js';
import fs from 'fs';

async function applySync() {
  try {
    const sql = fs.readFileSync('sync_existing_staff.sql', 'utf8');
    await pool.query(sql);
    console.log('Successfully synced existing staff members to public.users.');
  } catch (err) {
    console.error('Error syncing staff:', err);
  } finally {
    process.exit();
  }
}

applySync();
