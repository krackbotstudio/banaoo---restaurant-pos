import pool from '../db.js';

await pool.query(
  `ALTER TABLE public.profiles
   ADD COLUMN IF NOT EXISTS dashboard_quick_actions jsonb`
);
console.log('profiles.dashboard_quick_actions ready');
await pool.end();
