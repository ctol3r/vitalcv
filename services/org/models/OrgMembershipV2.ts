/**
 * B195A-MULTIORG-001: Clinician-scoped OrgMembershipV2 model
 * Tracks org memberships for clinicians with lifecycle status + role metadata.
 */

import {
  OrgMembershipRole,
  OrgMembershipV2Status,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const JsonRecordSchema = z.record(z.any());

const CreateOrgMembershipV2Schema = z.object({
  clinicianId: z.string().min(1, 'clinicianId is required'),
  orgId: z.string().min(1, 'orgId is required'),
  role: z.nativeEnum(OrgMembershipRole).default(OrgMembershipRole.VIEWER),
  membershipStatus: z
    .nativeEnum(OrgMembershipV2Status)
    .default(OrgMembershipV2Status.INVITED),
  joinedAt: z.coerce.date().optional(),
  invitedBy: z.string().min(1).optional(),
  metadata: JsonRecordSchema.optional(),
});

export type CreateOrgMembershipV2Input = z.infer<typeof CreateOrgMembershipV2Schema>;

export type OrgMembershipV2WithOrg = Awaited<ReturnType<typeof getOrgMembershipV2>>;

const STATUS_TRANSITIONS: Record<OrgMembershipV2Status, OrgMembershipV2Status[]> = {
  [OrgMembershipV2Status.INVITED]: [
    OrgMembershipV2Status.PENDING,
    OrgMembershipV2Status.ACTIVE,
    OrgMembershipV2Status.SUSPENDED,
  ],
  [OrgMembershipV2Status.PENDING]: [
    OrgMembershipV2Status.ACTIVE,
    OrgMembershipV2Status.SUSPENDED,
  ],
  [OrgMembershipV2Status.ACTIVE]: [
    OrgMembershipV2Status.SUSPENDED,
    OrgMembershipV2Status.PENDING,
  ],
  [OrgMembershipV2Status.SUSPENDED]: [
    OrgMembershipV2Status.PENDING,
    OrgMembershipV2Status.ACTIVE,
  ],
};

/**
 * Create or update a clinician membership entry for an org.
 */
export async function upsertOrgMembershipV2(
  input: CreateOrgMembershipV2Input
): Promise<OrgMembershipV2WithOrg> {
  const payload = CreateOrgMembershipV2Schema.parse(input);
  const joinedAt = resolveJoinedAt(payload.membershipStatus, payload.joinedAt);
  const metadataValue = (payload.metadata ?? null) as Prisma.JsonValue | null;

  return prisma.orgMembershipV2.upsert({
    where: {
      clinicianId_orgId: {
        clinicianId: payload.clinicianId,
        orgId: payload.orgId,
      },
    },
    update: {
      role: payload.role,
      membershipStatus: payload.membershipStatus,
      joinedAt,
      invitedBy: payload.invitedBy ?? null,
      metadata: metadataValue,
    },
    create: {
      clinicianId: payload.clinicianId,
      orgId: payload.orgId,
      role: payload.role,
      membershipStatus: payload.membershipStatus,
      joinedAt,
      invitedBy: payload.invitedBy ?? null,
      metadata: metadataValue,
    },
    include: basicOrgSelect,
  });
}

/**
 * Shortcut helper to record an invitation for a clinician.
 */
export function inviteClinicianToOrg(
  clinicianId: string,
  orgId: string,
  invitedBy?: string,
  metadata?: Prisma.JsonValue
) {
  return upsertOrgMembershipV2({
    clinicianId,
    orgId,
    invitedBy,
    metadata,
    membershipStatus: OrgMembershipV2Status.INVITED,
  });
}

/**
 * Transition membership status while enforcing lifecycle rules.
 */
export async function updateOrgMembershipV2Status(
  clinicianId: string,
  orgId: string,
  nextStatus: OrgMembershipV2Status,
  options: { joinedAt?: Date | string; metadata?: Prisma.JsonValue } = {}
) {
  const membership = await getOrgMembershipV2(clinicianId, orgId);

  if (!membership) {
    throw new Error('OrgMembershipV2 not found for clinician/org');
  }

  const allowedTransitions = STATUS_TRANSITIONS[membership.membershipStatus];
  if (!allowedTransitions.includes(nextStatus)) {
    throw new Error(
      `Cannot transition membership from ${membership.membershipStatus} to ${nextStatus}`
    );
  }

  const candidateDate = options.joinedAt
    ? options.joinedAt instanceof Date
      ? options.joinedAt
      : new Date(options.joinedAt)
    : membership.joinedAt ?? undefined;
  const joinedAt = resolveJoinedAt(nextStatus, candidateDate);

  return prisma.orgMembershipV2.update({
    where: {
      clinicianId_orgId: { clinicianId, orgId },
    },
    data: {
      membershipStatus: nextStatus,
      joinedAt,
      metadata: options.metadata ?? membership.metadata ?? null,
    },
    include: basicOrgSelect,
  });
}

/**
 * Get membership record for clinician/org combo.
 */
export function getOrgMembershipV2(clinicianId: string, orgId: string) {
  return prisma.orgMembershipV2.findUnique({
    where: {
      clinicianId_orgId: { clinicianId, orgId },
    },
    include: basicOrgSelect,
  });
}

/**
 * List memberships for a clinician ordered by creation time.
 */
export function listMembershipsForClinician(
  clinicianId: string,
  status?: OrgMembershipV2Status
) {
  return prisma.orgMembershipV2.findMany({
    where: {
      clinicianId,
      ...(status ? { membershipStatus: status } : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
    include: basicOrgSelect,
  });
}

/**
 * List clinician memberships for an org with optional status filter.
 */
export function listMembershipsForOrg(orgId: string, status?: OrgMembershipV2Status) {
  return prisma.orgMembershipV2.findMany({
    where: {
      orgId,
      ...(status ? { membershipStatus: status } : {}),
    },
    orderBy: [{ createdAt: 'asc' }],
    include: {
      clinician: {
        select: {
          id: true,
          userId: true,
          npi: true,
          specialty: true,
          state: true,
        },
      },
    },
  });
}

/**
 * Remove membership (used when revoking clinician access to an org).
 */
export function removeOrgMembershipV2(clinicianId: string, orgId: string) {
  return prisma.orgMembershipV2.delete({
    where: {
      clinicianId_orgId: { clinicianId, orgId },
    },
  });
}

function resolveJoinedAt(status: OrgMembershipV2Status, provided?: Date) {
  if (provided) {
    return provided;
  }
  if (status === OrgMembershipV2Status.ACTIVE && !provided) {
    return new Date();
  }
  return null;
}

const basicOrgSelect = {
  org: {
    select: {
      id: true,
      partnerId: true,
      partnerName: true,
    },
  },
};

