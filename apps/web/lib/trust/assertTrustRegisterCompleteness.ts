import type { TrustRegisterSnapshot } from './register';

export interface TrustRegisterCompletenessResult {
  complete: boolean;
  checks: Record<string, boolean>;
  missing: string[];
}

/**
 * Asserts completeness invariants for a TrustRegisterSnapshot.
 *
 * All checks must pass for `complete` to be true.
 * `missing` lists the names of failed checks.
 */
export function assertTrustRegisterCompleteness(
  snapshot: TrustRegisterSnapshot,
): TrustRegisterCompletenessResult {
  const STALE_THRESHOLD_MS = 60 * 60 * 1000; // 60 minutes

  const checks: Record<string, boolean> = {
    issuerDid: typeof snapshot.issuerDid === 'string' && snapshot.issuerDid.length > 0,
    signingKeyId: snapshot.signingKeyId !== null && snapshot.signingKeyId !== undefined,
    proofTiers: snapshot.proofTiers.length >= 3,
    sources: snapshot.sources.length >= 3,
    verifierEndpoints: snapshot.verifierEndpoints.length >= 4,
    lastVerifiedAt: Date.now() - snapshot.lastVerifiedAt < STALE_THRESHOLD_MS,
    environment: typeof snapshot.environment === 'string' && snapshot.environment.length > 0,
  };

  const missing = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([key]) => key);

  return {
    complete: missing.length === 0,
    checks,
    missing,
  };
}
