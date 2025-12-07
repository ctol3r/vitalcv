/**
 * PersonalDataVault Model
 * B237A-DP-001: PersonalDataVault model
 *
 * Provides type-safe access to PersonalDataVault Prisma model
 * and helper functions for vault operations.
 */

import { PrismaClient, PersonalDataVault as PrismaVault } from '@prisma/client';

const prisma = new PrismaClient();

export type { PersonalDataVault as Vault } from '@prisma/client';

export interface CreateVaultInput {
  ownerId: string;
  encryptionKeyId: string;
  storageLocation?: string;
}

export interface UpdateVaultInput {
  storageLocation?: string;
  sizeBytes?: bigint;
}

/**
 * Create a new personal data vault
 */
export async function createVault(input: CreateVaultInput): Promise<PrismaVault> {
  return prisma.personalDataVault.create({
    data: {
      ownerId: input.ownerId,
      encryptionKeyId: input.encryptionKeyId,
      storageLocation: input.storageLocation,
      sizeBytes: 0n,
    },
  });
}

/**
 * Get vault by ID
 */
export async function getVaultById(vaultId: string): Promise<PrismaVault | null> {
  return prisma.personalDataVault.findUnique({
    where: { id: vaultId },
    include: {
      records: {
        where: { deletedAt: null },
      },
    },
  });
}

/**
 * Get vault by owner ID
 */
export async function getVaultByOwnerId(ownerId: string): Promise<PrismaVault | null> {
  return prisma.personalDataVault.findFirst({
    where: { ownerId },
    include: {
      records: {
        where: { deletedAt: null },
      },
    },
  });
}

/**
 * Update vault
 */
export async function updateVault(
  vaultId: string,
  input: UpdateVaultInput
): Promise<PrismaVault> {
  return prisma.personalDataVault.update({
    where: { id: vaultId },
    data: input,
  });
}

/**
 * Update vault size (increment by bytes)
 */
export async function incrementVaultSize(
  vaultId: string,
  bytes: bigint
): Promise<PrismaVault> {
  return prisma.personalDataVault.update({
    where: { id: vaultId },
    data: {
      sizeBytes: {
        increment: bytes,
      },
    },
  });
}

/**
 * Delete vault (cascade deletes all records)
 */
export async function deleteVault(vaultId: string): Promise<void> {
  await prisma.personalDataVault.delete({
    where: { id: vaultId },
  });
}

/**
 * Get vault statistics
 */
export async function getVaultStats(vaultId: string) {
  const vault = await prisma.personalDataVault.findUnique({
    where: { id: vaultId },
    include: {
      records: {
        where: { deletedAt: null },
      },
      _count: {
        select: {
          records: true,
          auditLogs: true,
          backups: true,
        },
      },
    },
  });

  if (!vault) {
    return null;
  }

  return {
    vaultId: vault.id,
    ownerId: vault.ownerId,
    sizeBytes: vault.sizeBytes,
    recordCount: vault._count.records,
    auditLogCount: vault._count.auditLogs,
    backupCount: vault._count.backups,
    createdAt: vault.createdAt,
    updatedAt: vault.updatedAt,
  };
}
