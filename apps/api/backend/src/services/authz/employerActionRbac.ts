/**
 * Employer-review mutation RBAC — pure decision core (Wave B).
 *
 * Decides whether a caller may perform a mutating employer-review action
 * (accept / request-refresh / route-to-review / share-packet / confirm-start).
 * Roles come from the server-side User table (clerkUserId → role/status),
 * never from caller-supplied headers like x-verifier-team-role.
 *
 * Pure transform: no fetches, no DB reads, no audit writes. The route layer
 * resolves the User row and handles shadow-vs-enforced rollout
 * (VERIFIER_RBAC_ENFORCED) plus the denied-mutation AuditEvent.
 */
import type { UserRole, UserStatus } from '@prisma/client';

export interface EmployerActionRbacSubject {
  role: UserRole;
  status: UserStatus;
}

export interface EmployerActionRbacDecision {
  allowed: boolean;
  /** Set only on deny; stable machine-readable reason for audit rows + logs. */
  denialReason:
    | 'rbac_unknown_user'
    | 'rbac_user_inactive'
    | 'rbac_role_not_permitted'
    | null;
  /** Role the caller resolved to, or null when no User row exists. */
  resolvedRole: UserRole | null;
}

/** Roles permitted to perform employer-review mutations. */
export const EMPLOYER_MUTATION_ALLOWED_ROLES: readonly UserRole[] = [
  'VERIFIER',
  'ADMIN',
];

/**
 * Decision rules:
 * - No User row → deny (`rbac_unknown_user`). A header alone is not an identity.
 * - SUSPENDED / DEACTIVATED → deny (`rbac_user_inactive`). INVITED is not
 *   hard-denied: it is the schema default and pilots activate lazily; the
 *   shadow-mode rollout measures whether INVITED callers exist before any
 *   tightening.
 * - CLINICIAN / ISSUER → deny (`rbac_role_not_permitted`). A clinician must
 *   never be able to accept their own passport as an employer.
 * - VERIFIER / ADMIN → allow.
 */
export function decideEmployerActionRbac(
  user: EmployerActionRbacSubject | null,
): EmployerActionRbacDecision {
  if (!user) {
    return { allowed: false, denialReason: 'rbac_unknown_user', resolvedRole: null };
  }
  if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
    return {
      allowed: false,
      denialReason: 'rbac_user_inactive',
      resolvedRole: user.role,
    };
  }
  if (!EMPLOYER_MUTATION_ALLOWED_ROLES.includes(user.role)) {
    return {
      allowed: false,
      denialReason: 'rbac_role_not_permitted',
      resolvedRole: user.role,
    };
  }
  return { allowed: true, denialReason: null, resolvedRole: user.role };
}
