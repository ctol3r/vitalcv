/**
 * B251A-CON-002: ContractVersion Model
 *
 * Schema: id, contractId (FK), versionNumber (int), content (markdown or HTML),
 * authorId, changeSummary, createdAt; includes relation to attachments;
 * updates Contract.currentVersionId when published
 */

import { PrismaClient } from '@prisma/client';

export interface ContractVersionInput {
  contractId: string;
  versionNumber: number;
  content: string; // Markdown or HTML
  authorId: string;
  changeSummary?: string;
  attachments?: any[]; // Array of attachment references
}

export interface ContractVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  content: string;
  authorId: string;
  changeSummary: string | null;
  attachments: any | null;
  createdAt: Date;
}

/**
 * Validate version content is not empty
 */
export function validateVersionContent(content: string): void {
  if (!content || content.trim().length === 0) {
    throw new Error('Version content cannot be empty');
  }
}

/**
 * Create a new contract version
 */
export async function createContractVersion(
  prisma: PrismaClient,
  input: ContractVersionInput
): Promise<ContractVersion> {
  validateVersionContent(input.content);

  // Verify contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: input.contractId },
  });
  if (!contract) {
    throw new Error(`Contract with id "${input.contractId}" not found`);
  }

  // Check if version number already exists for this contract
  const existing = await prisma.contractVersion.findUnique({
    where: {
      contractId_versionNumber: {
        contractId: input.contractId,
        versionNumber: input.versionNumber,
      },
    },
  });
  if (existing) {
    throw new Error(
      `Version ${input.versionNumber} already exists for contract ${input.contractId}`
    );
  }

  return prisma.contractVersion.create({
    data: {
      contractId: input.contractId,
      versionNumber: input.versionNumber,
      content: input.content,
      authorId: input.authorId,
      changeSummary: input.changeSummary || null,
      attachments: input.attachments ? JSON.parse(JSON.stringify(input.attachments)) : null,
    },
  });
}

/**
 * Get contract version by ID
 */
export async function getContractVersion(
  prisma: PrismaClient,
  versionId: string
): Promise<ContractVersion | null> {
  return prisma.contractVersion.findUnique({
    where: { id: versionId },
  });
}

/**
 * List versions for a contract
 */
export async function listContractVersions(
  prisma: PrismaClient,
  contractId: string
): Promise<ContractVersion[]> {
  return prisma.contractVersion.findMany({
    where: { contractId },
    orderBy: { versionNumber: 'desc' },
  });
}

/**
 * Get latest version for a contract
 */
export async function getLatestContractVersion(
  prisma: PrismaClient,
  contractId: string
): Promise<ContractVersion | null> {
  return prisma.contractVersion.findFirst({
    where: { contractId },
    orderBy: { versionNumber: 'desc' },
  });
}

/**
 * Publish a version (updates Contract.currentVersionId)
 */
export async function publishContractVersion(
  prisma: PrismaClient,
  contractId: string,
  versionId: string
): Promise<ContractVersion> {
  // Verify version belongs to contract
  const version = await prisma.contractVersion.findUnique({
    where: { id: versionId },
  });

  if (!version || version.contractId !== contractId) {
    throw new Error('Version does not belong to this contract');
  }

  // Update contract's current version
  await prisma.contract.update({
    where: { id: contractId },
    data: { currentVersionId: versionId },
  });

  return version;
}

/**
 * Get next version number for a contract
 */
export async function getNextVersionNumber(
  prisma: PrismaClient,
  contractId: string
): Promise<number> {
  const latest = await getLatestContractVersion(prisma, contractId);
  return latest ? latest.versionNumber + 1 : 1;
}

