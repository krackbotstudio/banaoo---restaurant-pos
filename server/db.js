import pg from 'pg';
import './load-env.js';

const { Pool } = pg;

// Self-hosted Supabase (Dokploy) typically doesn't have SSL on Postgres.
// Set DATABASE_SSL=false in env to disable, or leave unset for auto-detection.
function getSslConfig() {
  // Explicit override via env var
  if (process.env.DATABASE_SSL === 'false') return false;
  if (process.env.DATABASE_SSL === 'true') return { rejectUnauthorized: false };

  // Auto-detect: disable SSL for localhost and self-hosted Dokploy (traefik.me)
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.includes('localhost') || dbUrl.includes('traefik.me') || dbUrl.includes('api.banaoo.in')) {
    return false;
  }

  // Production with hosted Supabase (supabase.co) — use SSL
  if (process.env.NODE_ENV === 'production') {
    return { rejectUnauthorized: false };
  }

  return false;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: getSslConfig(),
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle pg client:', err);
});

export default pool;
