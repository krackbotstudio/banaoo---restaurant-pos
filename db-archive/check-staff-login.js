// Legacy debug helper: lists recent staff and verifies users-table sync.
// Usage: node db-archive/check-staff-login.js
import pool from '../server/db.js';

async function checkStaff() {
  try {
    const { rows: staff } = await pool.query('SELECT * FROM public.staff_members ORDER BY created_at DESC LIMIT 5');
    console.log('Recent Staff Members:');
    for (const s of staff) {
      console.log(`- ID: ${s.id}, Email: ${s.system_email}, PIN: ${s.pin_code}, Active: ${s.is_active}`);
      const { rows: users } = await pool.query('SELECT * FROM public.users WHERE email = $1 OR id = $2', [s.system_email, s.id]);
      if (users.length > 0) {
        console.log(`  Found in users: ${users[0].email} (ID: ${users[0].id})`);
      } else {
        console.log(`  NOT found in users!`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkStaff();
