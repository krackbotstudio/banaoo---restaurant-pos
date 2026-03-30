import pool from './server/db.js';
import fs from 'fs';

async function applySql() {
  try {
    const sql = fs.readFileSync('update_trigger.sql', 'utf8');
    await pool.query(sql);
    console.log('Successfully updated handle_new_user trigger.');
  } catch (err) {
    console.error('Error updating trigger:', err);
  } finally {
    process.exit();
  }
}

applySql();
