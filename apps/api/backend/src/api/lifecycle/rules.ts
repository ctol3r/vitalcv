import { CredentialLifecycle } from './models';

export type CredentialLifecyclePhase = 'ACTIVE' | 'RENEWAL_WINDOW' | 'EXPIRED';

function normalizeExpiry(expiresAt: Date | string): Date {
  if (expiresAt instanceof Date) return expiresAt;
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error('Invalid expiresAt value; expected Date or RFC3339 string');
  }
  return parsed;
}

export function renewalWindowOpensAt(lifecycle: CredentialLifecycle): Date {
  const expiresAt = normalizeExpiry(lifecycle.expiresAt);
  const windowMs = lifecycle.renewalWindowDays * 24 * 60 * 60 * 1000;
  return new Date(expiresAt.getTime() - windowMs);
}

export function daysUntilExpiry(lifecycle: CredentialLifecycle, asOf = new Date()): number {
  const expiresAt = normalizeExpiry(lifecycle.expiresAt);
  const diffMs = expiresAt.getTime() - asOf.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

export function lifecyclePhase(
  lifecycle: CredentialLifecycle,
  asOf = new Date(),
): CredentialLifecyclePhase {
  const expiresAt = normalizeExpiry(lifecycle.expiresAt);
  const windowStart = renewalWindowOpensAt(lifecycle);

  if (asOf >= expiresAt) return 'EXPIRED';
  if (asOf >= windowStart) return 'RENEWAL_WINDOW';
  return 'ACTIVE';
}
