/**
 * FOUNDATION-SWEEP-7 — verifier organization roles foundation.
 *
 * This module is a typed vocabulary only. It does not provision accounts,
 * enforce RBAC, or activate invitations.
 */

export type OrgRole = 'admin' | 'reviewer' | 'read_only';

export type OrgMemberStatus = 'active' | 'invited' | 'suspended';

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface OrgRolesFoundation {
  provisionLive: false;
  /** Flipped to literal true once the live invitation route + accept flow shipped. */
  invitationSystemLive: true;
  rbacEnforced: false;
  roles: OrgRole[];
  memberStatuses: OrgMemberStatus[];
  invitationStatuses: InvitationStatus[];
  disclaimers: string[];
}

export function buildOrgRolesFoundation(): OrgRolesFoundation {
  return {
    provisionLive: false,
    invitationSystemLive: true,
    rbacEnforced: false,
    roles: ['admin', 'reviewer', 'read_only'],
    memberStatuses: ['active', 'invited', 'suspended'],
    invitationStatuses: ['pending', 'accepted', 'expired', 'revoked'],
    disclaimers: [
      'Organization roles are a foundation vocabulary; production permissions are not enforced here.',
      'Invitations are sent through Clerk hosted email; this module does not perform direct SMTP delivery.',
    ],
  };
}

export function explainOrgRole(role: OrgRole): string {
  switch (role) {
    case 'admin':
      return 'Can coordinate organization settings and reviewer assignment once production RBAC is connected; this foundation grants no live permissions.';
    case 'reviewer':
      return 'Can participate in internal application assessment workflows once production RBAC is connected; this foundation grants no live permissions.';
    case 'read_only':
      return 'Can view assigned review context once production RBAC is connected; this foundation grants no live permissions.';
  }
}
