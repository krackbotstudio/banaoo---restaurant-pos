import pool from './db.js';

async function checkNotifications() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'notifications'
      ORDER BY ordinal_position
    `);
    
    if (rows.length === 0) {
      console.log('No notifications table found.');
    } else {
      console.log('Notifications Table Columns:');
      console.log(JSON.stringify(rows, null, 2));
    }
  } catch (err) {
    console.error('Error checking notifications:', err);
  } finally {
    process.exit();
  }
}

checkNotifications();
