import { sha256Hex } from './deterministic';

export interface CanonicalClaim {
  type: string;
  value: string | number | boolean | null;
}

export function hashClaim(claim: CanonicalClaim): string {
  const payload = `${claim.type}:${String(claim.value)}`;
  return sha256Hex(payload);
}
