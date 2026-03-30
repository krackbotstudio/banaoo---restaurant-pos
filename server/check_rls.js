import pool from './db.js';

async function checkRLS() {
  try {
    const { rows } = await pool.query(`
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND (tablename = 'menu_items' OR tablename = 'outlets' OR tablename = 'profiles')
    `);
    
    console.log('RLS Status (rowsecurity=t means ENABLED, f means DISABLED):');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error('Error checking RLS:', err);
  } finally {
    process.exit();
  }
}

checkRLS();
