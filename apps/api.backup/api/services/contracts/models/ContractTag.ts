/**
 * B251A-CON-008: ContractTag Model and ContractTagMap
 *
 * Defines ContractTag model: id, name, slug; and ContractTagMap join table (contractId, tagId);
 * supports many-to-many tag associations
 */

import { PrismaClient } from '@prisma/client';

export interface ContractTagInput {
  name: string;
  slug: string;
}

export interface ContractTag {
  id: string;
  name: string;
  slug: string;
}

export interface ContractTagMap {
  id: string;
  contractId: string;
  tagId: string;
  createdAt: Date;
}

/**
 * Validate slug format (alphanumeric, hyphens, underscores)
 */
export function validateTagSlug(slug: string): void {
  const slugPattern = /^[a-z0-9_-]+$/;
  if (!slugPattern.test(slug)) {
    throw new Error(
      'Invalid slug format. Use only lowercase letters, numbers, hyphens, and underscores.'
    );
  }
}

/**
 * Create a new contract tag
 */
export async function createContractTag(
  prisma: PrismaClient,
  input: ContractTagInput
): Promise<ContractTag> {
  validateTagSlug(input.slug);

  // Check if slug already exists
  const existingBySlug = await prisma.contractTag.findUnique({
    where: { slug: input.slug },
  });
  if (existingBySlug) {
    throw new Error(`Tag with slug "${input.slug}" already exists`);
  }

  // Check if name already exists
  const existingByName = await prisma.contractTag.findUnique({
    where: { name: input.name },
  });
  if (existingByName) {
    throw new Error(`Tag with name "${input.name}" already exists`);
  }

  return prisma.contractTag.create({
    data: {
      name: input.name,
      slug: input.slug,
    },
  });
}

/**
 * Get contract tag by ID
 */
export async function getContractTag(
  prisma: PrismaClient,
  tagId: string
): Promise<ContractTag | null> {
  return prisma.contractTag.findUnique({
    where: { id: tagId },
  });
}

/**
 * Get contract tag by slug
 */
export async function getContractTagBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<ContractTag | null> {
  return prisma.contractTag.findUnique({
    where: { slug },
  });
}

/**
 * Get contract tag by name
 */
export async function getContractTagByName(
  prisma: PrismaClient,
  name: string
): Promise<ContractTag | null> {
  return prisma.contractTag.findUnique({
    where: { name },
  });
}

/**
 * List all contract tags
 */
export async function listContractTags(prisma: PrismaClient): Promise<ContractTag[]> {
  return prisma.contractTag.findMany({
    orderBy: { name: 'asc' },
  });
}

/**
 * Update contract tag
 */
export async function updateContractTag(
  prisma: PrismaClient,
  tagId: string,
  updates: Partial<ContractTagInput>
): Promise<ContractTag> {
  if (updates.slug) {
    validateTagSlug(updates.slug);
    // Check if slug is taken by another tag
    const existing = await prisma.contractTag.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== tagId) {
      throw new Error(`Tag with slug "${updates.slug}" already exists`);
    }
  }

  if (updates.name) {
    // Check if name is taken by another tag
    const existing = await prisma.contractTag.findUnique({
      where: { name: updates.name },
    });
    if (existing && existing.id !== tagId) {
      throw new Error(`Tag with name "${updates.name}" already exists`);
    }
  }

  return prisma.contractTag.update({
    where: { id: tagId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
    },
  });
}

/**
 * Delete contract tag (cascades to tag mappings)
 */
export async function deleteContractTag(prisma: PrismaClient, tagId: string): Promise<void> {
  await prisma.contractTag.delete({
    where: { id: tagId },
  });
}

/**
 * Add tag to contract (create tag mapping)
 */
export async function addTagToContract(
  prisma: PrismaClient,
  contractId: string,
  tagId: string
): Promise<ContractTagMap> {
  // Verify contract exists
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
  });
  if (!contract) {
    throw new Error(`Contract with id "${contractId}" not found`);
  }

  // Verify tag exists
  const tag = await prisma.contractTag.findUnique({
    where: { id: tagId },
  });
  if (!tag) {
    throw new Error(`Tag with id "${tagId}" not found`);
  }

  // Check if mapping already exists
  const existing = await prisma.contractTagMap.findUnique({
    where: {
      contractId_tagId: {
        contractId,
        tagId,
      },
    },
  });
  if (existing) {
    throw new Error(`Tag "${tagId}" is already assigned to contract "${contractId}"`);
  }

  return prisma.contractTagMap.create({
    data: {
      contractId,
      tagId,
    },
  });
}

/**
 * Remove tag from contract (delete tag mapping)
 */
export async function removeTagFromContract(
  prisma: PrismaClient,
  contractId: string,
  tagId: string
): Promise<void> {
  await prisma.contractTagMap.delete({
    where: {
      contractId_tagId: {
        contractId,
        tagId,
      },
    },
  });
}

/**
 * Get tags for a contract
 */
export async function getContractTags(
  prisma: PrismaClient,
  contractId: string
): Promise<ContractTag[]> {
  const mappings = await prisma.contractTagMap.findMany({
    where: { contractId },
    include: { tag: true },
  });

  return mappings.map((mapping) => mapping.tag);
}

/**
 * Get contracts for a tag
 */
export async function getTagContracts(prisma: PrismaClient, tagId: string): Promise<string[]> {
  const mappings = await prisma.contractTagMap.findMany({
    where: { tagId },
    select: { contractId: true },
  });

  return mappings.map((mapping) => mapping.contractId);
}

