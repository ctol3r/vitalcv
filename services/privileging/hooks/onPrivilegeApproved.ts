import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { enqueueJob } from '../../queue/producer.js';
import { calculateFPPEDueDate, FPPECaseStatus } from '../models/FPPECase.js';
import { getChecklistTemplate, normalizePrivilegeCode } from '../fppeChecklist.js';

const privilegeIssuanceEvent = z.object({
  privilegeRequestId: z.string(),
  privilegeGrantedId: z.string(),
  clinicianDid: z.string(),
  orgId: z.string(),
  privilegeSetId: z.string(),
  reviewerDid: z.string(),
});

export type PrivilegeIssuanceEvent = z.infer<typeof privilegeIssuanceEvent>;

const prisma = new PrismaClient();

export async function enqueuePrivilegeIssuance(
  event: PrivilegeIssuanceEvent
): Promise<string> {
  const payload = privilegeIssuanceEvent.parse(event);
  const jobId = await enqueueJob('PRIVILEGE_ISSUE', payload);
  return jobId;
}

export interface FppeCaseCreationParams {
  privilegeGrantedId: string;
  privilegeRequestId: string;
  clinicianId: string;
  orgId: string;
  privilegeCode: string;
  reviewerDid?: string;
  startAt?: Date;
}

type PrismaFppeClient = Pick<PrismaClient, 'fPPECase' | 'auditEvent'>;

export async function createFPPECaseForApprovedPrivilege(
  params: FppeCaseCreationParams,
  client: PrismaFppeClient = prisma
) {
  const startAt = params.startAt ?? new Date();
  const dueAt = calculateFPPEDueDate(startAt);
  const normalizedCode = normalizePrivilegeCode(params.privilegeCode);
  const checklist = getChecklistTemplate(normalizedCode);

  const fppeCase = await client.fPPECase.create({
    data: {
      clinicianId: params.clinicianId,
      orgId: params.orgId,
      privilegeGrantedId: params.privilegeGrantedId,
      privilegeCode: normalizedCode,
      startAt,
      dueAt,
      status: FPPECaseStatus.OPEN,
      checklist: checklist as Prisma.InputJsonValue,
    },
  });

  await client.auditEvent.create({
    data: {
      type: 'FPPE_CASE_CREATED',
      subjectNpi: null,
      data: {
        fppeCaseId: fppeCase.id,
        privilegeGrantedId: params.privilegeGrantedId,
        privilegeRequestId: params.privilegeRequestId,
        clinicianId: params.clinicianId,
        orgId: params.orgId,
        privilegeCode: normalizedCode,
        dueAt: dueAt.toISOString(),
        reviewerDid: params.reviewerDid ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  return fppeCase;
}
