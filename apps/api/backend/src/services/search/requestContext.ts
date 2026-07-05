import {
  ActivePersona,
  MembershipRole,
  SearchAclLevel,
} from '@prisma/client';
import type { Request } from 'express';
import { getRequestOrganizationId } from '../../middleware/organizationContext';
import { sha256Hex } from '../../utils/deterministic';
import {
  getHydratedWorkspaceUserByClerkUserId,
  type HydratedWorkspaceMembership,
  type WorkspaceUserRecord,
} from '../workspace/workspaceService';

// The schema has no User→PersonProfile→membership relations, so this context
// is hydrated through workspaceService's stitch helper instead of a Prisma
// `include` (which fails at runtime). The old include filtered memberships to
// `active: true` — activeMembershipsOf preserves that semantic.
type WorkspaceUser = WorkspaceUserRecord;

type ActiveMembership = HydratedWorkspaceMembership;

function activeMembershipsOf(user: WorkspaceUser | null): ActiveMembership[] {
  return (user?.personProfile?.memberships ?? []).filter((membership) => membership.active);
}

export interface SearchRequestContext {
  aclLevel: SearchAclLevel;
  isAuthenticated: boolean;
  clerkUserId?: string;
  clerkUserEmail?: string;
  organizationId?: string;
  activePersona?: ActivePersona;
  membershipRoles: string[];
  queryHash?: string;
}

function getHeaderValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return getHeaderValue(value[0]);
  }

  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeRoleValue(value: string | undefined): string | undefined {
  const trimmed = value?.trim().toUpperCase();
  return trimmed ? trimmed : undefined;
}

function pickRequestedMembership(
  memberships: ActiveMembership[],
  requestedOrgId: string | undefined,
): ActiveMembership | undefined {
  if (!requestedOrgId) {
    return undefined;
  }

  return memberships.find(
    (membership) => membership.organizationProfile.organizationId === requestedOrgId,
  );
}

function derivePersona(user: WorkspaceUser | null, activeMembership: ActiveMembership | undefined): ActivePersona | undefined {
  if (user?.workspacePreference?.activePersona) {
    return user.workspacePreference.activePersona;
  }

  if (activeMembership) {
    return ActivePersona.VERIFIER;
  }

  if (user?.personProfile) {
    return ActivePersona.CLINICIAN;
  }

  return undefined;
}

function deriveAclLevel(params: {
  clerkUserId?: string;
  headerRole?: string;
  activePersona?: ActivePersona;
  activeMembership?: ActiveMembership;
  hasPersonProfile: boolean;
}): SearchAclLevel {
  if (!params.clerkUserId) {
    return 'PUBLIC';
  }

  if (params.headerRole === 'ADMIN') {
    return 'ADMIN';
  }

  if (params.headerRole === 'VERIFIER') {
    return 'VERIFIER';
  }

  if (
    params.activeMembership &&
    params.activeMembership.role !== MembershipRole.HOLDER &&
    (params.activePersona === ActivePersona.VERIFIER || params.activePersona === ActivePersona.BOTH)
  ) {
    return 'VERIFIER';
  }

  if (
    params.hasPersonProfile &&
    (params.activePersona === ActivePersona.CLINICIAN || params.activePersona === ActivePersona.BOTH)
  ) {
    return 'HOLDER';
  }

  if (params.hasPersonProfile) {
    return 'HOLDER';
  }

  return 'AUTHENTICATED';
}

function deriveOrganizationId(
  user: WorkspaceUser | null,
  requestedOrgId: string | undefined,
): string | undefined {
  const memberships = activeMembershipsOf(user);
  if (requestedOrgId) {
    const requestedMembership = pickRequestedMembership(memberships, requestedOrgId);
    if (requestedMembership) {
      return requestedMembership.organizationProfile.organizationId;
    }
  }

  const activeOrgId = user?.workspacePreference?.activeOrgId;
  if (activeOrgId) {
    const activeMembership = pickRequestedMembership(memberships, activeOrgId);
    if (activeMembership) {
      return activeMembership.organizationProfile.organizationId;
    }
  }

  return memberships[0]?.organizationProfile.organizationId;
}

function buildRoleHints(params: {
  headerRole?: string;
  aclLevel: SearchAclLevel;
  activePersona?: ActivePersona;
  memberships: ActiveMembership[];
}): string[] {
  const roleHints = new Set<string>();

  if (params.headerRole) {
    roleHints.add(params.headerRole);
  }

  roleHints.add(params.aclLevel);

  if (params.aclLevel !== 'PUBLIC') {
    roleHints.add('AUTHENTICATED');
  }

  if (params.activePersona) {
    roleHints.add(params.activePersona);
  }

  for (const membership of params.memberships) {
    roleHints.add(membership.role);
  }

  return [...roleHints];
}

export async function resolveSearchRequestContext(
  req: Request,
  queryText?: string,
): Promise<SearchRequestContext> {
  const clerkUserId = getHeaderValue(req.headers['x-clerk-user-id']);
  const clerkUserEmail = getHeaderValue(req.headers['x-clerk-user-email']);
  const headerRole = normalizeRoleValue(getHeaderValue(req.headers['x-clerk-user-role']));

  if (!clerkUserId) {
    return {
      aclLevel: 'PUBLIC',
      isAuthenticated: false,
      queryHash: queryText ? sha256Hex(queryText.trim().toLowerCase()) : undefined,
      membershipRoles: ['PUBLIC'],
    };
  }

  const user = await getHydratedWorkspaceUserByClerkUserId(clerkUserId);

  const requestedOrgId = getRequestOrganizationId(req);
  const resolvedOrganizationId = deriveOrganizationId(user, requestedOrgId);
  const memberships = activeMembershipsOf(user);
  const activeMembership = pickRequestedMembership(memberships, resolvedOrganizationId) ?? memberships[0];
  const activePersona = derivePersona(user, activeMembership);
  const aclLevel = deriveAclLevel({
    clerkUserId,
    headerRole,
    activePersona,
    activeMembership,
    hasPersonProfile: Boolean(user?.personProfile),
  });

  return {
    aclLevel,
    isAuthenticated: true,
    clerkUserId,
    clerkUserEmail,
    organizationId: resolvedOrganizationId,
    activePersona,
    membershipRoles: buildRoleHints({
      headerRole,
      aclLevel,
      activePersona,
      memberships,
    }),
    queryHash: queryText ? sha256Hex(queryText.trim().toLowerCase()) : undefined,
  };
}
