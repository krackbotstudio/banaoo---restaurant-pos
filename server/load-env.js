import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load root .env first, then optional overrides (.env.local is gitignored).
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true });

export function isGoogleAuthEnabled() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  return Boolean(clientId && clientId !== 'PLACEHOLDER_GOOGLE_CLIENT_ID');
}
