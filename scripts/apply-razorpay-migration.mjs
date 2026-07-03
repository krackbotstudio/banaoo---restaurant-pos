import '../server/load-env.js';
import fs from 'fs';
import path from 'path';
import pool from '../server/db.js';

const files = [
  'supabase/migrations/20260702000100_razorpay_payments_addon.sql',
  'supabase/migrations/20260702000200_razorpay_payments_addon_type.sql',
  'supabase/migrations/20260703000100_razorpay_api_key_connect.sql',
];

for (const file of files) {
  const sql = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
  console.log('Applying', file);
  try {
    await pool.query(sql);
    console.log('  OK');
  } catch (err) {
    console.error('  FAILED:', err.message);
    throw err;
  }
}

const { rows } = await pool.query(
  `SELECT column_name FROM information_schema.columns WHERE table_name = 'razorpay_connections' ORDER BY 1`,
);
console.log('razorpay_connections columns:', rows.map((r) => r.column_name).join(', '));
await pool.end();
