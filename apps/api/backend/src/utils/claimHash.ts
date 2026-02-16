import { createHash } from 'node:crypto';

export interface CanonicalClaim {
  type: string;
  value: string | number | boolean | null;
}

export function hashClaim(claim: CanonicalClaim): string {
  const payload = `${claim.type}:${String(claim.value)}`;
  return createHash('sha256').update(payload).digest('hex');
}
