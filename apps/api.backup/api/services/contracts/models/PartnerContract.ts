/**
 * B231A-CON-001: PartnerContract Model
 *
 * Model for partner contracts with lifecycle management.
 */

import { PrismaClient, Prisma } from '@prisma/client';

export type ContractStatus = 'draft' | 'negotiating' | 'signed' | 'terminated';

export interface PartnerContractInput {
  orgId: string;
  counterpartyId: string;
  templateId?: string;
  status?: ContractStatus;
  effectiveDate?: Date;
  expiryDate?: Date;
  terms?: Record<string, any>; // Contract-specific terms (JSONB)
  revenueShareId?: string;
  metadata?: Record<string, any>;
}

export interface PartnerContract {
  id: string;
  orgId: string;
  counterpartyId: string;
  templateId: string | null;
  status: ContractStatus;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  terms: any;
  revenueShareId: string | null;
  metadata: any;
  signedPdfUrl: string | null;
  signatureEvents: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate contract status transition
 */
export function validateStatusTransition(
  currentStatus: ContractStatus,
  newStatus: ContractStatus
): void {
  const validTransitions: Record<ContractStatus, ContractStatus[]> = {
    draft: ['negotiating', 'terminated'],
    negotiating: ['signed', 'draft', 'terminated'],
    signed: ['terminated'],
    terminated: [], // Cannot transition from terminated
  };

  if (!validTransitions[currentStatus].includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }
}

/**
 * Validate date ranges
 */
export function validateDateRange(
  effectiveDate?: Date,
  expiryDate?: Date
): void {
  if (effectiveDate && expiryDate && effectiveDate >= expiryDate) {
    throw new Error('Effective date must be before expiry date');
  }
}

/**
 * Create a new partner contract
 */
export async function createPartnerContract(
  prisma: PrismaClient,
  input: PartnerContractInput
): Promise<PartnerContract> {
  validateDateRange(input.effectiveDate, input.expiryDate);

  return prisma.partnerContract.create({
    data: {
      orgId: input.orgId,
      counterpartyId: input.counterpartyId,
      templateId: input.templateId ?? null,
      status: input.status || 'draft',
      effectiveDate: input.effectiveDate ?? null,
      expiryDate: input.expiryDate ?? null,
      terms: input.terms ? (input.terms as Prisma.InputJsonValue) : null,
      revenueShareId: input.revenueShareId ?? null,
      metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : null,
    },
  });
}

/**
 * Get partner contract by ID
 */
export async function getPartnerContract(
  prisma: PrismaClient,
  contractId: string
): Promise<PartnerContract | null> {
  return prisma.partnerContract.findUnique({
    where: { id: contractId },
  });
}

/**
 * List partner contracts with optional filters
 */
export async function listPartnerContracts(
  prisma: PrismaClient,
  options?: {
    orgId?: string;
    counterpartyId?: string;
    status?: ContractStatus;
    templateId?: string;
  }
): Promise<PartnerContract[]> {
  const where: any = {};

  if (options?.orgId) {
    where.orgId = options.orgId;
  }
  if (options?.counterpartyId) {
    where.counterpartyId = options.counterpartyId;
  }
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.templateId) {
    where.templateId = options.templateId;
  }

  return prisma.partnerContract.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update partner contract
 */
export async function updatePartnerContract(
  prisma: PrismaClient,
  contractId: string,
  updates: Partial<PartnerContractInput> & { status?: ContractStatus }
): Promise<PartnerContract> {
  const contract = await getPartnerContract(prisma, contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  // Validate status transition if status is being changed
  if (updates.status && updates.status !== contract.status) {
    validateStatusTransition(contract.status, updates.status);
  }

  // Validate date range if dates are being updated
  const effectiveDate = updates.effectiveDate ?? contract.effectiveDate ?? undefined;
  const expiryDate = updates.expiryDate ?? contract.expiryDate ?? undefined;
  validateDateRange(effectiveDate, expiryDate);

  return prisma.partnerContract.update({
    where: { id: contractId },
    data: {
      ...(updates.orgId && { orgId: updates.orgId }),
      ...(updates.counterpartyId && { counterpartyId: updates.counterpartyId }),
      ...(updates.templateId !== undefined && { templateId: updates.templateId ?? null }),
      ...(updates.status && { status: updates.status }),
      ...(updates.effectiveDate !== undefined && { effectiveDate: updates.effectiveDate ?? null }),
      ...(updates.expiryDate !== undefined && { expiryDate: updates.expiryDate ?? null }),
      ...(updates.terms !== undefined && { terms: updates.terms as Prisma.InputJsonValue }),
      ...(updates.revenueShareId !== undefined && { revenueShareId: updates.revenueShareId ?? null }),
      ...(updates.metadata !== undefined && { metadata: updates.metadata as Prisma.InputJsonValue }),
    },
  });
}

/**
 * Update contract status
 */
export async function updateContractStatus(
  prisma: PrismaClient,
  contractId: string,
  newStatus: ContractStatus
): Promise<PartnerContract> {
  const contract = await getPartnerContract(prisma, contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  validateStatusTransition(contract.status, newStatus);

  return prisma.partnerContract.update({
    where: { id: contractId },
    data: { status: newStatus },
  });
}

/**
 * Record signature events
 */
export async function recordSignatureEvents(
  prisma: PrismaClient,
  contractId: string,
  events: Array<{
    eventType: string;
    timestamp: Date;
    signerId: string;
    signerEmail: string;
    metadata?: Record<string, any>;
  }>
): Promise<PartnerContract> {
  const contract = await getPartnerContract(prisma, contractId);
  if (!contract) {
    throw new Error(`Contract ${contractId} not found`);
  }

  const existingEvents = (contract.signatureEvents as any) || [];
  const updatedEvents = [...existingEvents, ...events];

  return prisma.partnerContract.update({
    where: { id: contractId },
    data: {
      signatureEvents: updatedEvents as Prisma.InputJsonValue,
    },
  });
}

/**
 * Set signed PDF URL
 */
export async function setSignedPdfUrl(
  prisma: PrismaClient,
  contractId: string,
  pdfUrl: string
): Promise<PartnerContract> {
  return prisma.partnerContract.update({
    where: { id: contractId },
    data: {
      signedPdfUrl: pdfUrl,
      status: 'signed',
    },
  });
}

/**
 * Find contracts expiring soon
 */
export async function findContractsExpiringSoon(
  prisma: PrismaClient,
  daysAhead: number = 30
): Promise<PartnerContract[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

  return prisma.partnerContract.findMany({
    where: {
      status: 'signed',
      expiryDate: {
        lte: cutoffDate,
        gte: new Date(), // Not already expired
      },
    },
    orderBy: { expiryDate: 'asc' },
  });
}

