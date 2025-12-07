/**
 * B251A-CON-001: Contract Model
 *
 * Defines contract schema: id, title, slug, type (NDA/service/partnership/etc.),
 * status (draft/under_review/active/terminated), effectiveDate, expirationDate,
 * currentVersionId (FK), parties (array of ContractParty IDs or via join),
 * authorId, createdAt, updatedAt
 */

import { PrismaClient, ContractType, ContractStatus } from '@prisma/client';

export interface ContractInput {
  title: string;
  slug: string;
  type: ContractType;
  status?: ContractStatus;
  effectiveDate?: Date;
  expirationDate?: Date;
  authorId: string;
}

export interface Contract {
  id: string;
  title: string;
  slug: string;
  type: ContractType;
  status: ContractStatus;
  effectiveDate: Date | null;
  expirationDate: Date | null;
  currentVersionId: string | null;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate slug format (alphanumeric, hyphens, underscores)
 */
export function validateSlug(slug: string): void {
  const slugPattern = /^[a-z0-9_-]+$/;
  if (!slugPattern.test(slug)) {
    throw new Error(
      'Invalid slug format. Use only lowercase letters, numbers, hyphens, and underscores.'
    );
  }
}

/**
 * Create a new contract
 */
export async function createContract(
  prisma: PrismaClient,
  input: ContractInput
): Promise<Contract> {
  validateSlug(input.slug);

  // Check if slug already exists
  const existing = await prisma.contract.findUnique({
    where: { slug: input.slug },
  });
  if (existing) {
    throw new Error(`Contract with slug "${input.slug}" already exists`);
  }

  return prisma.contract.create({
    data: {
      title: input.title,
      slug: input.slug,
      type: input.type,
      status: input.status || ContractStatus.DRAFT,
      effectiveDate: input.effectiveDate || null,
      expirationDate: input.expirationDate || null,
      authorId: input.authorId,
    },
  });
}

/**
 * Get contract by ID
 */
export async function getContract(
  prisma: PrismaClient,
  contractId: string
): Promise<Contract | null> {
  return prisma.contract.findUnique({
    where: { id: contractId },
  });
}

/**
 * Get contract by slug
 */
export async function getContractBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<Contract | null> {
  return prisma.contract.findUnique({
    where: { slug },
  });
}

/**
 * List contracts with optional filters
 */
export async function listContracts(
  prisma: PrismaClient,
  options?: {
    type?: ContractType;
    status?: ContractStatus;
    authorId?: string;
    slug?: string;
  }
): Promise<Contract[]> {
  const where: any = {};

  if (options?.type) {
    where.type = options.type;
  }
  if (options?.status) {
    where.status = options.status;
  }
  if (options?.authorId) {
    where.authorId = options.authorId;
  }
  if (options?.slug) {
    where.slug = { contains: options.slug, mode: 'insensitive' };
  }

  return prisma.contract.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Update contract
 */
export async function updateContract(
  prisma: PrismaClient,
  contractId: string,
  updates: Partial<ContractInput & { status: ContractStatus }>
): Promise<Contract> {
  if (updates.slug) {
    validateSlug(updates.slug);
    // Check if slug is taken by another contract
    const existing = await prisma.contract.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== contractId) {
      throw new Error(`Contract with slug "${updates.slug}" already exists`);
    }
  }

  return prisma.contract.update({
    where: { id: contractId },
    data: {
      ...(updates.title && { title: updates.title }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.type && { type: updates.type }),
      ...(updates.status && { status: updates.status }),
      ...(updates.effectiveDate !== undefined && { effectiveDate: updates.effectiveDate || null }),
      ...(updates.expirationDate !== undefined && { expirationDate: updates.expirationDate || null }),
    },
  });
}

/**
 * Update contract's current version (publishes version)
 */
export async function updateContractCurrentVersion(
  prisma: PrismaClient,
  contractId: string,
  versionId: string
): Promise<Contract> {
  // Verify version belongs to contract
  const version = await prisma.contractVersion.findUnique({
    where: { id: versionId },
  });

  if (!version || version.contractId !== contractId) {
    throw new Error('Version does not belong to this contract');
  }

  return prisma.contract.update({
    where: { id: contractId },
    data: { currentVersionId: versionId },
  });
}

/**
 * Delete contract
 */
export async function deleteContract(prisma: PrismaClient, contractId: string): Promise<void> {
  await prisma.contract.delete({
    where: { id: contractId },
  });
}

