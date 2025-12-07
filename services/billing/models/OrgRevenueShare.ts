/**
 * S72-STRETCH-E-001: OrgRevenueShare Model
 *
 * Stores organization revenue share configuration:
 * - basisPoints: 0-10000 (0% to 100%)
 * - minGuarantee: Minimum guarantee in cents (floor)
 * - maxCap: Maximum cap in cents
 */

import { PrismaClient } from '@prisma/client';

export interface OrgRevenueShareInput {
  orgId: string;
  basisPoints: number; // 0-10000
  minGuarantee?: number; // in cents
  maxCap?: number; // in cents
}

export interface OrgRevenueShare {
  id: string;
  orgId: string;
  basisPoints: number;
  minGuarantee: number | null;
  maxCap: number | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate basisPoints is in valid range (0-10000)
 */
export function validateBasisPoints(basisPoints: number): void {
  if (basisPoints < 0 || basisPoints > 10000) {
    throw new Error(`basisPoints must be between 0 and 10000, got ${basisPoints}`);
  }
}

/**
 * Validate minGuarantee and maxCap are positive if provided
 */
export function validateGuarantees(minGuarantee?: number, maxCap?: number): void {
  if (minGuarantee !== undefined && minGuarantee < 0) {
    throw new Error(`minGuarantee must be non-negative, got ${minGuarantee}`);
  }
  if (maxCap !== undefined && maxCap < 0) {
    throw new Error(`maxCap must be non-negative, got ${maxCap}`);
  }
  if (minGuarantee !== undefined && maxCap !== undefined && minGuarantee > maxCap) {
    throw new Error(`minGuarantee (${minGuarantee}) cannot exceed maxCap (${maxCap})`);
  }
}

/**
 * Create or update organization revenue share configuration
 */
export async function upsertOrgRevenueShare(
  prisma: PrismaClient,
  input: OrgRevenueShareInput
): Promise<OrgRevenueShare> {
  validateBasisPoints(input.basisPoints);
  validateGuarantees(input.minGuarantee, input.maxCap);

  return prisma.orgRevenueShare.upsert({
    where: { orgId: input.orgId },
    update: {
      basisPoints: input.basisPoints,
      minGuarantee: input.minGuarantee ?? null,
      maxCap: input.maxCap ?? null,
      updatedAt: new Date(),
    },
    create: {
      orgId: input.orgId,
      basisPoints: input.basisPoints,
      minGuarantee: input.minGuarantee ?? null,
      maxCap: input.maxCap ?? null,
    },
  });
}

/**
 * Get organization revenue share configuration
 */
export async function getOrgRevenueShare(
  prisma: PrismaClient,
  orgId: string
): Promise<OrgRevenueShare | null> {
  return prisma.orgRevenueShare.findUnique({
    where: { orgId },
  });
}

/**
 * Delete organization revenue share configuration
 */
export async function deleteOrgRevenueShare(
  prisma: PrismaClient,
  orgId: string
): Promise<void> {
  await prisma.orgRevenueShare.delete({
    where: { orgId },
  });
}

