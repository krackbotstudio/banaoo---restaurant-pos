import pool from './db.js';

async function checkStaffSchema() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'staff_members'
      ORDER BY ordinal_position
    `);
    
    if (rows.length === 0) {
      console.log('No staff_members table found.');
    } else {
      console.log('Staff Members Table Columns:');
      console.log(JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error('Error checking staff schema:', err);
  } finally {
    process.exit();
  }
}

checkStaffSchema();
