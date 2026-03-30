import pool from './db.js';

async function checkSchema() {
  try {
    const { rows } = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles'
      AND column_name IN ('id', 'user_id')
    `);
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Schema check error:', err);
    process.exit(1);
  }
}

checkSchema();
