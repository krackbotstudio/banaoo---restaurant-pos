import pool from './db.js';

async function checkAdmins() {
  try {
    const { rows } = await pool.query(`
      SELECT u.email, p.full_name, p.is_admin 
      FROM public.users u 
      JOIN public.profiles p ON u.id = p.user_id 
      WHERE p.is_admin = true
    `);
    
    if (rows.length === 0) {
      console.log('No admin users found in the database.');
    } else {
      console.log('Admin Users:');
      rows.forEach(row => {
        console.log(`- Email: ${row.email}, Name: ${row.full_name}`);
      });
    }
  } catch (err) {
    console.error('Error checking admins:', err);
  } finally {
    process.exit();
  }
}

checkAdmins();
