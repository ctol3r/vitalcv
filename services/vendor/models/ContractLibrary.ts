/**
 * B240A-VM-005: ContractLibrary model
 *
 * Stores standard contract templates: id, name, version, content (HTML or markdown),
 * effectiveDate, expiryDate, jurisdiction, createdAt
 */

import { PrismaClient } from '@prisma/client';

export interface ContractLibraryInput {
  name: string;
  version?: string;
  content: string; // HTML or markdown
  effectiveDate: Date;
  expiryDate?: Date;
  jurisdiction?: string;
}

export interface ContractLibrary {
  id: string;
  name: string;
  version: string;
  content: string;
  effectiveDate: Date;
  expiryDate: Date | null;
  jurisdiction: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate contract library input
 */
export function validateContractLibraryInput(input: ContractLibraryInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('content is required');
  }
  if (!input.effectiveDate) {
    throw new Error('effectiveDate is required');
  }
  if (input.expiryDate && input.expiryDate < input.effectiveDate) {
    throw new Error('expiryDate must be after effectiveDate');
  }
}

/**
 * Create contract library template
 */
export async function createContractLibrary(
  prisma: PrismaClient,
  input: ContractLibraryInput
): Promise<ContractLibrary> {
  validateContractLibraryInput(input);

  return prisma.contractLibrary.create({
    data: {
      name: input.name,
      version: input.version || '1.0',
      content: input.content,
      effectiveDate: input.effectiveDate,
      expiryDate: input.expiryDate ?? null,
      jurisdiction: input.jurisdiction ?? null,
    },
  });
}

/**
 * Get contract library by ID
 */
export async function getContractLibrary(
  prisma: PrismaClient,
  id: string
): Promise<ContractLibrary | null> {
  return prisma.contractLibrary.findUnique({
    where: { id },
  });
}

/**
 * Get contract library by name and version
 */
export async function getContractLibraryByNameAndVersion(
  prisma: PrismaClient,
  name: string,
  version: string
): Promise<ContractLibrary | null> {
  return prisma.contractLibrary.findFirst({
    where: {
      name,
      version,
    },
  });
}

/**
 * List contract libraries with optional filters
 */
export async function listContractLibraries(
  prisma: PrismaClient,
  options?: {
    jurisdiction?: string;
    activeOnly?: boolean; // Only return non-expired contracts
    name?: string;
  }
): Promise<ContractLibrary[]> {
  const now = new Date();
  return prisma.contractLibrary.findMany({
    where: {
      ...(options?.jurisdiction && { jurisdiction: options.jurisdiction }),
      ...(options?.name && { name: { contains: options.name, mode: 'insensitive' } }),
      ...(options?.activeOnly && {
        OR: [
          { expiryDate: null },
          { expiryDate: { gt: now } },
        ],
        effectiveDate: { lte: now },
      }),
    },
    orderBy: [
      { name: 'asc' },
      { version: 'desc' },
    ],
  });
}

/**
 * Update contract library
 */
export async function updateContractLibrary(
  prisma: PrismaClient,
  id: string,
  updates: Partial<ContractLibraryInput>
): Promise<ContractLibrary> {
  if (updates.expiryDate && updates.effectiveDate) {
    if (updates.expiryDate < updates.effectiveDate) {
      throw new Error('expiryDate must be after effectiveDate');
    }
  }

  // If updating dates, need to check existing record
  if (updates.expiryDate || updates.effectiveDate) {
    const existing = await prisma.contractLibrary.findUnique({
      where: { id },
    });
    if (existing) {
      const effectiveDate = updates.effectiveDate || existing.effectiveDate;
      const expiryDate = updates.expiryDate ?? existing.expiryDate;
      if (expiryDate && expiryDate < effectiveDate) {
        throw new Error('expiryDate must be after effectiveDate');
      }
    }
  }

  return prisma.contractLibrary.update({
    where: { id },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.version && { version: updates.version }),
      ...(updates.content && { content: updates.content }),
      ...(updates.effectiveDate && { effectiveDate: updates.effectiveDate }),
      ...(updates.expiryDate !== undefined && { expiryDate: updates.expiryDate ?? null }),
      ...(updates.jurisdiction !== undefined && { jurisdiction: updates.jurisdiction ?? null }),
    },
  });
}

/**
 * Delete contract library
 */
export async function deleteContractLibrary(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  // Check if any contracts use this template
  const contracts = await prisma.vendorContract.findMany({
    where: { templateId: id },
    take: 1,
  });

  if (contracts.length > 0) {
    throw new Error('Cannot delete template: contracts are still using it');
  }

  await prisma.contractLibrary.delete({
    where: { id },
  });
}

