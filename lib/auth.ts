import { cookies } from 'next/headers';
import { createHash } from 'crypto';

export function adminToken() {
  const pw = process.env.ADMIN_PASSWORD || '';
  return createHash('sha256').update(`knallhart:${pw}`).digest('hex');
}

export async function isAdmin() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  const store = await cookies();
  return store.get('ks_admin')?.value === adminToken();
}
