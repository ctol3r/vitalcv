import { CredentialLifecycleState } from '../utils/lifecycleState';

type CredentialStateInput = {
  revokedAt: Date | null;
  suspendedAt: Date | null;
  expiresAt: Date | null;
  status?: string | null;
};

const LEGACY_STATE_TO_LIFECYCLE: Readonly<Record<string, CredentialLifecycleState>> = {
  verified: CredentialLifecycleState.ACTIVE,
  verified_monitoring: CredentialLifecycleState.ACTIVE,
  expiring_soon: CredentialLifecycleState.ACTIVE,
  needs_review: CredentialLifecycleState.SUSPENDED,
  expired: CredentialLifecycleState.EXPIRED,
  revoked: CredentialLifecycleState.REVOKED,
  active: CredentialLifecycleState.ACTIVE,
};

export function mapLegacyLifecycleState(status: string | null | undefined): CredentialLifecycleState | null {
  if (!status) {
    return null;
  }

  const normalizedStatus = status.toLowerCase().trim();
  const mapped = LEGACY_STATE_TO_LIFECYCLE[normalizedStatus];
  if (mapped !== undefined) {
    return mapped;
  }

  return null;
}

export function computeCredentialState(
  artifact: CredentialStateInput,
  now: Date = new Date(),
): CredentialLifecycleState {
  if (artifact.revokedAt instanceof Date) {
    return CredentialLifecycleState.REVOKED;
  }

  if (artifact.suspendedAt instanceof Date) {
    return CredentialLifecycleState.SUSPENDED;
  }

  if (artifact.expiresAt instanceof Date && artifact.expiresAt.getTime() < now.getTime()) {
    return CredentialLifecycleState.EXPIRED;
  }

  const mapped = mapLegacyLifecycleState(artifact.status);
  if (mapped !== null) {
    return mapped;
  }

  return CredentialLifecycleState.ACTIVE;
}

export function isCredentialActive(artifact: CredentialStateInput, now: Date = new Date()): boolean {
  return computeCredentialState(artifact, now) === CredentialLifecycleState.ACTIVE;
}
