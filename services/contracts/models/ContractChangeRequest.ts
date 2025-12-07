/**
 * B251A-CON-006: ContractChangeRequest Model
 *
 * Schema: id, contractId (FK), requestedBy (userId), changeSummary,
 * status (pending/approved/rejected), createdAt, decisionBy (userId), decisionAt
 */

import { PrismaClient, ChangeRequestStatus } from '@prisma/client';

export interface ContractChangeRequestInput {
  contractId: string;
  requestedBy: string; // User ID
  changeSummary: string;
  status?: ChangeRequestStatus;
}

export interface ContractChangeRequest {
  id: string;
  contractId: string;
  requestedBy: string;
  changeSummary: string;
  status: ChangeRequestStatus;
  createdAt: Date;
  decisionBy: string | null;
  decisionAt: Date | null;
}

/**
 * Create a new contract change request
 */
export async function createContractChangeRequest(
  prisma: PrismaClient,
  input: ContractChangeRequestInput
): Promise<ContractChangeRequest> {
  if (!input.changeSummary || input.changeSummary.trim().length === 0) {
    throw new Error('Change summary cannot be empty');
  }

  // Verify contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
  });
  if (!contract) {
    throw new Error(`Contract with id "${input.contractId}" not found`);
  }

  return prisma.contractChangeRequest.create({
    data: {
      contractId: input.contractId,
      requestedBy: input.requestedBy,
      changeSummary: input.changeSummary,
      status: input.status || ChangeRequestStatus.PENDING,
    },
  });
}

/**
 * Get contract change request by ID
 */
export async function getContractChangeRequest(
  prisma: PrismaClient,
  requestId: string
): Promise<ContractChangeRequest | null> {
  return prisma.contractChangeRequest.findUnique({
    where: { id: requestId },
  });
}

/**
 * List change requests for a contract
 */
export async function listContractChangeRequests(
  prisma: PrismaClient,
  contractId: string,
  status?: ChangeRequestStatus
): Promise<ContractChangeRequest[]> {
  const where: any = { contractId };
  if (status) {
    where.status = status;
  }

  return prisma.contractChangeRequest.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Approve a change request
 */
export async function approveChangeRequest(
  prisma: PrismaClient,
  requestId: string,
  decisionBy: string // User ID
): Promise<ContractChangeRequest> {
  return prisma.contractChangeRequest.update({
    where: { id: requestId },
    data: {
      status: ChangeRequestStatus.APPROVED,
      decisionBy,
      decisionAt: new Date(),
    },
  });
}

/**
 * Reject a change request
 */
export async function rejectChangeRequest(
  prisma: PrismaClient,
  requestId: string,
  decisionBy: string // User ID
): Promise<ContractChangeRequest> {
  return prisma.contractChangeRequest.update({
    where: { id: requestId },
    data: {
      status: ChangeRequestStatus.REJECTED,
      decisionBy,
      decisionAt: new Date(),
    },
  });
}

/**
 * Update change request
 */
export async function updateContractChangeRequest(
  prisma: PrismaClient,
  requestId: string,
  updates: Partial<Pick<ContractChangeRequestInput, 'changeSummary' | 'status'>>
): Promise<ContractChangeRequest> {
  if (updates.changeSummary && updates.changeSummary.trim().length === 0) {
    throw new Error('Change summary cannot be empty');
  }

  return prisma.contractChangeRequest.update({
    where: { id: requestId },
    data: {
      ...(updates.changeSummary && { changeSummary: updates.changeSummary }),
      ...(updates.status && { status: updates.status }),
    },
  });
}

/**
 * Delete contract change request
 */
export async function deleteContractChangeRequest(
  prisma: PrismaClient,
  requestId: string
): Promise<void> {
  await prisma.contractChangeRequest.delete({
    where: { id: requestId },
  });
}

