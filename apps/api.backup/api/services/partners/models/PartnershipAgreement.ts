/**
 * B248A-PARTNER-003: PartnershipAgreement Model
 *
 * Schema: id, partnerId, agreementType (NDA/contract), documentId (file reference),
 * startDate, endDate, status (draft/submitted/active/expired), notes, createdAt, updatedAt
 */

import { PrismaClient, AgreementType, AgreementStatus } from '@prisma/client';

export interface PartnershipAgreementInput {
  partnerId: string;
  agreementType: AgreementType;
  documentId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: AgreementStatus;
  notes?: string;
}

export interface PartnershipAgreement {
  id: string;
  partnerId: string;
  agreementType: AgreementType;
  documentId: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: AgreementStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate partnership agreement input
 */
export function validatePartnershipAgreementInput(input: PartnershipAgreementInput): void {
  if (!input.partnerId || input.partnerId.trim().length === 0) {
    throw new Error('partnerId is required');
  }
  if (!Object.values(AgreementType).includes(input.agreementType)) {
    throw new Error(`agreementType must be one of: ${Object.values(AgreementType).join(', ')}`);
  }
  if (input.startDate && input.endDate && input.startDate > input.endDate) {
    throw new Error('startDate must be before endDate');
  }
}

/**
 * Verify partner exists
 */
async function verifyPartnerExists(prisma: PrismaClient, partnerId: string): Promise<void> {
  const partner = await prisma.partnerProfile.findUnique({
    where: { id: partnerId },
  });
  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }
}

/**
 * Create partnership agreement
 */
export async function createPartnershipAgreement(
  prisma: PrismaClient,
  input: PartnershipAgreementInput
): Promise<PartnershipAgreement> {
  validatePartnershipAgreementInput(input);
  await verifyPartnerExists(prisma, input.partnerId);

  return prisma.partnershipAgreement.create({
    data: {
      partnerId: input.partnerId,
      agreementType: input.agreementType,
      documentId: input.documentId ?? null,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status ?? AgreementStatus.draft,
      notes: input.notes ?? null,
    },
  });
}

/**
 * Get partnership agreement by ID
 */
export async function getPartnershipAgreement(
  prisma: PrismaClient,
  id: string
): Promise<PartnershipAgreement | null> {
  return prisma.partnershipAgreement.findUnique({
    where: { id },
  });
}

/**
 * Get partnership agreements by partner ID
 */
export async function getPartnershipAgreementsByPartner(
  prisma: PrismaClient,
  partnerId: string
): Promise<PartnershipAgreement[]> {
  return prisma.partnershipAgreement.findMany({
    where: { partnerId },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Get active agreements
 */
export async function getActiveAgreements(
  prisma: PrismaClient,
  partnerId?: string
): Promise<PartnershipAgreement[]> {
  const where: any = {
    status: AgreementStatus.active,
  };
  if (partnerId) {
    where.partnerId = partnerId;
  }

  return prisma.partnershipAgreement.findMany({
    where,
    orderBy: { startDate: 'desc' },
  });
}

/**
 * Get expired agreements
 */
export async function getExpiredAgreements(
  prisma: PrismaClient,
  partnerId?: string
): Promise<PartnershipAgreement[]> {
  const where: any = {
    status: AgreementStatus.expired,
  };
  if (partnerId) {
    where.partnerId = partnerId;
  }

  return prisma.partnershipAgreement.findMany({
    where,
    orderBy: { endDate: 'desc' },
  });
}

/**
 * Update partnership agreement
 */
export async function updatePartnershipAgreement(
  prisma: PrismaClient,
  id: string,
  updates: Partial<PartnershipAgreementInput>
): Promise<PartnershipAgreement> {
  if (updates.agreementType && !Object.values(AgreementType).includes(updates.agreementType)) {
    throw new Error(`agreementType must be one of: ${Object.values(AgreementType).join(', ')}`);
  }
  if (updates.partnerId) {
    await verifyPartnerExists(prisma, updates.partnerId);
  }

  // Validate date range if both dates are being updated
  const existing = await prisma.partnershipAgreement.findUnique({ where: { id } });
  const startDate = updates.startDate ?? existing?.startDate ?? null;
  const endDate = updates.endDate ?? existing?.endDate ?? null;
  if (startDate && endDate && startDate > endDate) {
    throw new Error('startDate must be before endDate');
  }

  return prisma.partnershipAgreement.update({
    where: { id },
    data: {
      ...(updates.partnerId !== undefined && { partnerId: updates.partnerId }),
      ...(updates.agreementType !== undefined && { agreementType: updates.agreementType }),
      ...(updates.documentId !== undefined && { documentId: updates.documentId ?? null }),
      ...(updates.startDate !== undefined && { startDate: updates.startDate ?? null }),
      ...(updates.endDate !== undefined && { endDate: updates.endDate ?? null }),
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.notes !== undefined && { notes: updates.notes ?? null }),
    },
  });
}

/**
 * Delete partnership agreement
 */
export async function deletePartnershipAgreement(
  prisma: PrismaClient,
  id: string
): Promise<PartnershipAgreement> {
  return prisma.partnershipAgreement.delete({
    where: { id },
  });
}

