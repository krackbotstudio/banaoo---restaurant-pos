import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load env in precedence order (later files override earlier ones).
dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config({ path: path.join(__dirname, '.env'), override: true });
dotenv.config({ path: path.join(projectRoot, '.env.local'), override: true });

export function isGoogleAuthEnabled() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  return Boolean(
    clientId &&
      clientSecret &&
      clientId !== 'PLACEHOLDER_GOOGLE_CLIENT_ID'
  );
}
