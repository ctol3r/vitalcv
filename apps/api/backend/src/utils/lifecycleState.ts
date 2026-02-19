export enum CredentialLifecycleState {
  ISSUED = 'issued',
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  REVOKED = 'revoked',
  EXPIRED = 'expired',
}

export function normalizeLifecycleState(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

export function isSameLifecycleState(left: unknown, right: unknown): boolean {
  return normalizeLifecycleState(left) === normalizeLifecycleState(right);
}
