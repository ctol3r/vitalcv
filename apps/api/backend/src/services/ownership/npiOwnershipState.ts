/**
 * NPI ownership states — Wave 1075.
 *
 * PR #1074 made private clinician data require an `NpiOwnership` row. That
 * closed anonymous disclosure, but the row itself was granted by
 * `POST /api/ownership/claim` with `verificationMethod: 'CLAIMED'` and no proof
 * at all — so any signed-in user could bind themselves to a stranger's NPI and
 * read that clinician's private readiness, credentials and share history. The
 * check was real; the thing it checked was a self-assertion.
 *
 * A claim is a REQUEST. Only verification turns it into authority.
 *
 * No migration: the existing columns already carry the distinction.
 *   verified   — revokedAt null, verifiedAt set, method in VERIFIED_METHODS
 *   delegated  — revokedAt null, verifiedAt set, method === 'DELEGATED'
 *   pending    — revokedAt null, verifiedAt NULL (this is what 'CLAIMED' is)
 *   revoked    — revokedAt set
 *
 * `verifiedAt` is the load-bearing field. A method string alone is not trusted:
 * a row could be written with method 'ADMIN_VERIFIED' and no timestamp, and
 * that must not authorize anything.
 */

export type NpiOwnershipState = 'verified' | 'delegated' | 'pending' | 'revoked';

/** Methods that represent real, accepted proof of individual ownership. */
export const VERIFIED_METHODS = new Set([
  'ADMIN_VERIFIED',
  'NPPES_IDENTITY_MATCH',
  'ISSUER_ATTESTED',
]);

/** An explicitly granted authority to act for a clinician who is not you. */
export const DELEGATED_METHOD = 'DELEGATED';

/** What a fresh, unproven claim is written as. Never authorizes. */
export const PENDING_METHOD = 'CLAIMED';

export interface OwnershipRowShape {
  verifiedAt: Date | null;
  verificationMethod: string | null;
  revokedAt: Date | null;
}

export function ownershipState(row: OwnershipRowShape | null | undefined): NpiOwnershipState | null {
  if (!row) return null;
  if (row.revokedAt) return 'revoked';
  // Unverified is unverified regardless of what the method column claims.
  if (!row.verifiedAt) return 'pending';
  const method = (row.verificationMethod ?? '').trim();
  if (method === DELEGATED_METHOD) return 'delegated';
  if (VERIFIED_METHODS.has(method)) return 'verified';
  // A timestamp with an unrecognised method is NOT a licence to proceed —
  // fail closed so a new method must be added here deliberately.
  return 'pending';
}

/** Only these two states may reach private clinician information. */
export function authorizesPrivateAccess(state: NpiOwnershipState | null): boolean {
  return state === 'verified' || state === 'delegated';
}

/**
 * The honest, user-facing sentence for a state that cannot proceed. Returned
 * to the client so the surface never has to invent its own explanation.
 */
export function blockedReason(state: NpiOwnershipState | null): string {
  switch (state) {
    case 'pending':
      return 'Identity verification required before private sharing is enabled.';
    case 'revoked':
      return 'This NPI association was revoked.';
    default:
      return 'This NPI is not linked to your account.';
  }
}
