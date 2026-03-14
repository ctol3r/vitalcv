import type { VerificationArtifactRecord } from './types';

function includesState(value: string | null | undefined, states: readonly string[]): boolean {
  const normalized = String(value ?? '').trim().toUpperCase();
  return states.includes(normalized);
}

export function evaluateRevocationState(
  artifact: Pick<
    VerificationArtifactRecord,
    'revokedAt' | 'suspendedAt' | 'status' | 'lifecycleState' | 'revocationReason'
  >,
): { revoked: boolean; reasons: string[] } {
  const reasons: string[] = [];

  if (artifact.revokedAt) {
    reasons.push(`artifact was revoked at ${artifact.revokedAt.toISOString()}`);
  }

  if (artifact.suspendedAt) {
    reasons.push(`artifact was suspended at ${artifact.suspendedAt.toISOString()}`);
  }

  if (includesState(artifact.status, ['REVOKED', 'SUSPENDED'])) {
    reasons.push(`artifact status is ${String(artifact.status).trim().toUpperCase()}`);
  }

  if (includesState(artifact.lifecycleState, ['REVOKED', 'SUSPENDED'])) {
    reasons.push(`artifact lifecycle is ${String(artifact.lifecycleState).trim().toUpperCase()}`);
  }

  if (reasons.length > 0 && artifact.revocationReason) {
    reasons.push(`revocation reason: ${artifact.revocationReason}`);
  }

  return {
    revoked: reasons.length > 0,
    reasons,
  };
}
