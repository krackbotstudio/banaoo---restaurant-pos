// Legacy debug helper: prints schema info for staff-related tables.
// Usage: node db-archive/check-db.js
import pool from '../server/db.js';

async function check() {
  try {
    const { rows: tables } = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    for (const t of ['staff_members', 'staff_outlet_links', 'staff_outlet_assignments']) {
      if (tables.some(row => row.table_name === t)) {
        console.log(`\nTable: ${t}`);
        const { rows: columns } = await pool.query(`SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${t}'`);
        console.log('Columns:', columns.map(c => `${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`).join(', '));
        
        const { rows: fks } = await pool.query(`
          SELECT
              kcu.column_name, 
              ccu.table_schema AS foreign_table_schema,
              ccu.table_name AS foreign_table_name,
              ccu.column_name AS foreign_column_name 
          FROM 
              information_schema.table_constraints AS tc 
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${t}';
        `);
        console.log('FKs:', fks.map(fk => `${fk.column_name} -> ${fk.foreign_table_schema}.${fk.foreign_table_name}(${fk.foreign_column_name})`).join(', '));
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
