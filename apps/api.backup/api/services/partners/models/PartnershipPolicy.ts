/**
 * B248A-PARTNER-006: PartnershipPolicy Model
 *
 * Stores policy documents or rules: id, name, content (markdown/JSON), version, publishedAt;
 * used to inform partners about guidelines
 */

import { PrismaClient } from '@prisma/client';

export interface PartnershipPolicyInput {
  name: string;
  content: string; // Markdown or JSON
  version: string;
  publishedAt?: Date;
}

export interface PartnershipPolicy {
  id: string;
  name: string;
  content: string;
  version: string;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate partnership policy input
 */
export function validatePartnershipPolicyInput(input: PartnershipPolicyInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.content || input.content.trim().length === 0) {
    throw new Error('content is required');
  }
  if (!input.version || input.version.trim().length === 0) {
    throw new Error('version is required');
  }
}

/**
 * Create partnership policy
 */
export async function createPartnershipPolicy(
  prisma: PrismaClient,
  input: PartnershipPolicyInput
): Promise<PartnershipPolicy> {
  validatePartnershipPolicyInput(input);

  return prisma.partnershipPolicy.create({
    data: {
      name: input.name,
      content: input.content,
      version: input.version,
      publishedAt: input.publishedAt ?? null,
    },
  });
}

/**
 * Get partnership policy by ID
 */
export async function getPartnershipPolicy(
  prisma: PrismaClient,
  id: string
): Promise<PartnershipPolicy | null> {
  return prisma.partnershipPolicy.findUnique({
    where: { id },
  });
}

/**
 * Get all partnership policies
 */
export async function getPartnershipPolicies(
  prisma: PrismaClient,
  options?: {
    publishedOnly?: boolean;
    skip?: number;
    take?: number;
  }
): Promise<PartnershipPolicy[]> {
  const where: any = {};
  if (options?.publishedOnly) {
    where.publishedAt = { not: null };
  }

  return prisma.partnershipPolicy.findMany({
    where,
    skip: options?.skip,
    take: options?.take,
    orderBy: { publishedAt: 'desc' },
  });
}

/**
 * Get published policies
 */
export async function getPublishedPolicies(
  prisma: PrismaClient
): Promise<PartnershipPolicy[]> {
  return prisma.partnershipPolicy.findMany({
    where: {
      publishedAt: { not: null },
    },
    orderBy: { publishedAt: 'desc' },
  });
}

/**
 * Get policy by version
 */
export async function getPolicyByVersion(
  prisma: PrismaClient,
  version: string
): Promise<PartnershipPolicy | null> {
  return prisma.partnershipPolicy.findFirst({
    where: { version },
    orderBy: { publishedAt: 'desc' },
  });
}

/**
 * Update partnership policy
 */
export async function updatePartnershipPolicy(
  prisma: PrismaClient,
  id: string,
  updates: Partial<PartnershipPolicyInput>
): Promise<PartnershipPolicy> {
  return prisma.partnershipPolicy.update({
    where: { id },
    data: {
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.content !== undefined && { content: updates.content }),
      ...(updates.version !== undefined && { version: updates.version }),
      ...(updates.publishedAt !== undefined && { publishedAt: updates.publishedAt ?? null }),
    },
  });
}

/**
 * Publish policy
 */
export async function publishPolicy(
  prisma: PrismaClient,
  id: string
): Promise<PartnershipPolicy> {
  return prisma.partnershipPolicy.update({
    where: { id },
    data: {
      publishedAt: new Date(),
    },
  });
}

/**
 * Delete partnership policy
 */
export async function deletePartnershipPolicy(
  prisma: PrismaClient,
  id: string
): Promise<PartnershipPolicy> {
  return prisma.partnershipPolicy.delete({
    where: { id },
  });
}

