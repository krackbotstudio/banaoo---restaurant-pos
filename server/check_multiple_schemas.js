import pool from './db.js';
import fs from 'fs';

async function checkMultipleSchemas() {
  try {
    const tables = ['outlets', 'menu_categories', 'menu_items'];
    let output = '';
    for (const table of tables) {
      const { rows } = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      output += `--- ${table} ---\n`;
      output += JSON.stringify(rows, null, 2) + '\n\n';
    }
    fs.writeFileSync('table_schemas.txt', output);
    console.log('Schemas written to table_schemas.txt');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

checkMultipleSchemas();
