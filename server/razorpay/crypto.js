import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;

function getKey() {
  const secret = process.env.RAZORPAY_ENCRYPTION_KEY || process.env.SESSION_SECRET;
  if (!secret) throw new Error('RAZORPAY_ENCRYPTION_KEY or SESSION_SECRET required');
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain) {
  if (!plain) return null;
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(encoded) {
  if (!encoded) return null;
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + 16);
  const data = buf.subarray(IV_LEN + 16);
  const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
