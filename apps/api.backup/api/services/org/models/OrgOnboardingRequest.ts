/**
 * B195A-MULTIORG-003: Org Onboarding Request model
 * Captures onboarding intents from organizations for clinicians, including privileges and EHR context.
 */

import {
  OrgOnboardingRequestStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

const PrivilegeDescriptorSchema = z.union([
  z.string().min(1),
  z.object({
    code: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    department: z.string().optional(),
  }),
]);

const JsonRecordSchema = z.record(z.any());

const CreateOrgOnboardingRequestSchema = z.object({
  clinicianId: z.string().min(1),
  orgId: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
  requiredPrivileges: z.array(PrivilegeDescriptorSchema).min(1),
  privilegeNotes: z.string().max(2000).optional(),
  ehrSystem: z.string().min(1),
  ehrConfiguration: JsonRecordSchema.optional(),
  notes: z.string().max(4000).optional(),
  metadata: JsonRecordSchema.optional(),
});

export type CreateOrgOnboardingRequestInput = z.infer<
  typeof CreateOrgOnboardingRequestSchema
>;

const STATUS_TRANSITIONS: Record<
  OrgOnboardingRequestStatus,
  OrgOnboardingRequestStatus[]
> = {
  [OrgOnboardingRequestStatus.PENDING]: [
    OrgOnboardingRequestStatus.IN_REVIEW,
    OrgOnboardingRequestStatus.APPROVED,
    OrgOnboardingRequestStatus.DECLINED,
    OrgOnboardingRequestStatus.CANCELLED,
  ],
  [OrgOnboardingRequestStatus.IN_REVIEW]: [
    OrgOnboardingRequestStatus.APPROVED,
    OrgOnboardingRequestStatus.DECLINED,
    OrgOnboardingRequestStatus.CANCELLED,
  ],
  [OrgOnboardingRequestStatus.APPROVED]: [],
  [OrgOnboardingRequestStatus.DECLINED]: [
    OrgOnboardingRequestStatus.PENDING,
    OrgOnboardingRequestStatus.CANCELLED,
  ],
  [OrgOnboardingRequestStatus.CANCELLED]: [],
};

const requestInclude = {
  org: {
    select: {
      id: true,
      partnerId: true,
      partnerName: true,
    },
  },
  clinician: {
    select: {
      id: true,
      userId: true,
      npi: true,
      specialty: true,
      state: true,
    },
  },
};

export type OrgOnboardingRequestWithRelations = Awaited<
  ReturnType<typeof getOrgOnboardingRequest>
>;

export async function createOrgOnboardingRequest(
  input: CreateOrgOnboardingRequestInput
): Promise<OrgOnboardingRequestWithRelations> {
  const payload = CreateOrgOnboardingRequestSchema.parse(input);
  const normalizedPrivileges = normalizePrivileges(payload.requiredPrivileges);

  return prisma.orgOnboardingRequest.create({
    data: {
      clinicianId: payload.clinicianId,
      orgId: payload.orgId,
      requestedBy: payload.requestedBy ?? null,
      requiredPrivileges: normalizedPrivileges as Prisma.JsonValue,
      privilegeNotes: payload.privilegeNotes ?? null,
      ehrSystem: payload.ehrSystem,
      ehrConfiguration: (payload.ehrConfiguration ?? null) as Prisma.JsonValue | null,
      notes: payload.notes ?? null,
      metadata: (payload.metadata ?? null) as Prisma.JsonValue | null,
    },
    include: requestInclude,
  });
}

export function getOrgOnboardingRequest(id: string) {
  return prisma.orgOnboardingRequest.findUnique({
    where: { id },
    include: requestInclude,
  });
}

export function listOrgOnboardingRequestsForClinician(
  clinicianId: string,
  status?: OrgOnboardingRequestStatus
) {
  return prisma.orgOnboardingRequest.findMany({
    where: {
      clinicianId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: requestInclude,
  });
}

export function listOrgOnboardingRequestsForOrg(
  orgId: string,
  status?: OrgOnboardingRequestStatus
) {
  return prisma.orgOnboardingRequest.findMany({
    where: {
      orgId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: requestInclude,
  });
}

export async function updateOrgOnboardingRequestStatus(
  id: string,
  nextStatus: OrgOnboardingRequestStatus,
  options: {
    reviewerId?: string;
    notes?: string;
    metadata?: Prisma.JsonValue;
  } = {}
) {
  const request = await getOrgOnboardingRequest(id);

  if (!request) {
    throw new Error('OrgOnboardingRequest not found');
  }

  const allowed = STATUS_TRANSITIONS[request.status];
  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `Cannot transition request from ${request.status} to ${nextStatus}`
    );
  }

  return prisma.orgOnboardingRequest.update({
    where: { id },
    data: {
      status: nextStatus,
      notes: options.notes ?? request.notes,
      metadata: options.metadata ?? (request.metadata as Prisma.JsonValue | null),
    },
    include: requestInclude,
  });
}

export function attachAutoAnalysisResult(
  id: string,
  payload: {
    taskId?: string;
    result: Prisma.JsonValue;
  }
) {
  return prisma.orgOnboardingRequest.update({
    where: { id },
    data: {
      autoAnalysisTaskId: payload.taskId ?? null,
      autoAnalysisResult: payload.result,
    },
    include: requestInclude,
  });
}

function normalizePrivileges(values: Array<z.infer<typeof PrivilegeDescriptorSchema>>) {
  return values.map((value) => {
    if (typeof value === 'string') {
      return { code: value };
    }
    return value;
  });
}

