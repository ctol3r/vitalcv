import { MembershipRole, UserRole, UserStatus } from '@prisma/client';
import type { Request } from 'express';

import type { VerifiedAuth } from '../../middleware/verifiedIdentity';
import { HttpError } from '../../utils/httpError';
import { getHydratedWorkspaceUserByClerkUserId } from '../workspace/workspaceService';

const MUTATION_ROLES = new Set<MembershipRole>([
  MembershipRole.ADMIN,
  MembershipRole.VERIFIER,
  MembershipRole.CREDENTIALING_SPECIALIST,
]);

export interface CredentialOpsViewer {
  clerkUserId: string;
  isPlatformAdmin: boolean;
  activeOrganizationId: string | null;
  activeMembershipRole: MembershipRole | null;
  activeOrganizationIds: string[];
}

function requireVerifiedClerkUserId(req: Request): string {
  const id = (req as Request & { verifiedAuth?: VerifiedAuth }).verifiedAuth?.verifiedUserId?.trim();
  if (!id) throw new HttpError(401, 'Verified Clerk session required.');
  return id;
}

export async function resolveCredentialOpsViewer(req: Request): Promise<CredentialOpsViewer> {
  const clerkUserId = requireVerifiedClerkUserId(req);
  const user = await getHydratedWorkspaceUserByClerkUserId(clerkUserId);
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new HttpError(403, 'Active account required.');
  }

  const memberships = (user.personProfile?.memberships ?? []).filter((membership) => membership.active);
  const preferred = user.workspacePreference?.activeOrgId
    ? memberships.find((membership) => (
      membership.organizationProfile.organizationId === user.workspacePreference?.activeOrgId
    ))
    : undefined;
  const active = preferred ?? (memberships.length === 1 ? memberships[0] : undefined);

  return {
    clerkUserId,
    isPlatformAdmin: user.role === UserRole.ADMIN,
    activeOrganizationId: active?.organizationProfile.organizationId ?? null,
    activeMembershipRole: active?.role ?? null,
    activeOrganizationIds: memberships.map((membership) => membership.organizationProfile.organizationId),
  };
}

export async function requireCredentialOpsOperator(req: Request): Promise<CredentialOpsViewer & {
  activeOrganizationId: string;
  activeMembershipRole: MembershipRole;
}> {
  const viewer = await resolveCredentialOpsViewer(req);
  if (!viewer.activeOrganizationId || !viewer.activeMembershipRole) {
    throw new HttpError(409, 'Select one active organization workspace before changing credential operations.');
  }
  if (!MUTATION_ROLES.has(viewer.activeMembershipRole)) {
    throw new HttpError(403, 'Credential-operations role required.');
  }
  return viewer as CredentialOpsViewer & {
    activeOrganizationId: string;
    activeMembershipRole: MembershipRole;
  };
}
