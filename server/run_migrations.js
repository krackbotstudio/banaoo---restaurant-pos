import pool from './db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  try {
    console.log('Reading migration.sql...');
    const migrationPath = path.join(__dirname, 'migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Applying migrations to database...');
    await pool.query(sql);
    console.log('Successfully applied migrations.');
  } catch (err) {
    console.error('Error applying migrations:', err);
  } finally {
    process.exit();
  }
}

runMigrations();
