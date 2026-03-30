import pool from './server/db.js';

async function checkRLS() {
  try {
    const { rows } = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('staff_members', 'staff_outlet_links', 'profiles', 'users');
    `);
    console.log('RLS Status:', rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

checkRLS();
