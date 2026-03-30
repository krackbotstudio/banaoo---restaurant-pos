import pool from './db.js';
import fs from 'fs';

async function getFullDefPlus() {
  try {
    const { rows } = await pool.query(`
      SELECT pg_get_functiondef(oid) as def
      FROM pg_proc 
      WHERE proname = 'seed_sample_data_for_user'
    `);
    fs.writeFileSync('function_def.txt', rows[0].def);
    console.log('Function definition written to function_def.txt');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

getFullDefPlus();
