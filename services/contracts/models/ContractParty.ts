/**
 * B251A-CON-003: ContractParty Model
 *
 * Defines parties: id, contractId (FK), organizationId (nullable), partnerId (nullable),
 * contactName, contactEmail, role (signer/witness/observer), signatureStatus (pending/signed/declined),
 * signedAt (nullable); validation ensures either organizationId or partnerId present
 */

import { PrismaClient, ContractPartyRole, SignatureStatus } from '@prisma/client';

export interface ContractPartyInput {
  contractId: string;
  organizationId?: string;
  partnerId?: string;
  contactName?: string;
  contactEmail?: string;
  role: ContractPartyRole;
  signatureStatus?: SignatureStatus;
}

export interface ContractParty {
  id: string;
  contractId: string;
  organizationId: string | null;
  partnerId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  role: ContractPartyRole;
  signatureStatus: SignatureStatus;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate that either organizationId or partnerId is present
 */
export function validatePartyIdentity(input: ContractPartyInput): void {
  if (!input.organizationId && !input.partnerId) {
    throw new Error('Either organizationId or partnerId must be provided');
  }
  if (input.organizationId && input.partnerId) {
    throw new Error('Cannot specify both organizationId and partnerId');
  }
}

/**
 * Validate email format if provided
 */
export function validateEmail(email: string | undefined): void {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email format');
  }
}

/**
 * Create a new contract party
 */
export async function createContractParty(
  prisma: PrismaClient,
  input: ContractPartyInput
): Promise<ContractParty> {
  validatePartyIdentity(input);
  if (input.contactEmail) {
    validateEmail(input.contactEmail);
  }

  // Verify contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
  });
  if (!contract) {
    throw new Error(`Contract with id "${input.contractId}" not found`);
  }

  return prisma.contractParty.create({
    data: {
      contractId: input.contractId,
      organizationId: input.organizationId || null,
      partnerId: input.partnerId || null,
      contactName: input.contactName || null,
      contactEmail: input.contactEmail || null,
      role: input.role,
      signatureStatus: input.signatureStatus || SignatureStatus.PENDING,
    },
  });
}

/**
 * Get contract party by ID
 */
export async function getContractParty(
  prisma: PrismaClient,
  partyId: string
): Promise<ContractParty | null> {
  return prisma.contractParty.findUnique({
    where: { id: partyId },
  });
}

/**
 * List parties for a contract
 */
export async function listContractParties(
  prisma: PrismaClient,
  contractId: string
): Promise<ContractParty[]> {
  return prisma.contractParty.findMany({
    where: { contractId },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Update contract party signature status
 */
export async function updatePartySignatureStatus(
  prisma: PrismaClient,
  partyId: string,
  status: SignatureStatus
): Promise<ContractParty> {
  const data: any = { signatureStatus: status };
  if (status === SignatureStatus.SIGNED) {
    data.signedAt = new Date();
  } else if (status === SignatureStatus.DECLINED) {
    data.signedAt = null;
  }

  return prisma.contractParty.update({
    where: { id: partyId },
    data,
  });
}

/**
 * Update contract party
 */
export async function updateContractParty(
  prisma: PrismaClient,
  partyId: string,
  updates: Partial<ContractPartyInput>
): Promise<ContractParty> {
  if (updates.contactEmail) {
    validateEmail(updates.contactEmail);
  }

  // If updating identity, validate
  if (updates.organizationId !== undefined || updates.partnerId !== undefined) {
    const existing = await prisma.contractParty.findUnique({
      where: { id: partyId },
    });
    if (existing) {
      const newInput = {
        organizationId: updates.organizationId ?? existing.organizationId,
        partnerId: updates.partnerId ?? existing.partnerId,
      };
      validatePartyIdentity(newInput as ContractPartyInput);
    }
  }

  return prisma.contractParty.update({
    where: { id: partyId },
    data: {
      ...(updates.organizationId !== undefined && { organizationId: updates.organizationId || null }),
      ...(updates.partnerId !== undefined && { partnerId: updates.partnerId || null }),
      ...(updates.contactName !== undefined && { contactName: updates.contactName || null }),
      ...(updates.contactEmail !== undefined && { contactEmail: updates.contactEmail || null }),
      ...(updates.role && { role: updates.role }),
      ...(updates.signatureStatus && { signatureStatus: updates.signatureStatus }),
    },
  });
}

/**
 * Delete contract party
 */
export async function deleteContractParty(prisma: PrismaClient, partyId: string): Promise<void> {
  await prisma.contractParty.delete({
    where: { id: partyId },
  });
}

