/**
 * DataRecord Model
 * B237A-DP-002: DataRecord model
 *
 * Provides type-safe access to DataRecord Prisma model
 * with support for versioning and indexing.
 */

import { PrismaClient, DataRecord as PrismaDataRecord, DataRecordType } from '@prisma/client';

const prisma = new PrismaClient();

export type { DataRecord } from '@prisma/client';
export { DataRecordType };

export interface CreateRecordInput {
  vaultId: string;
  type: DataRecordType;
  encryptedPayload: Buffer;
  metadata?: Record<string, any>;
  previousVersionId?: string;
  checksum?: string;
}

export interface UpdateRecordInput {
  encryptedPayload?: Buffer;
  metadata?: Record<string, any>;
  checksum?: string;
}

/**
 * Create a new data record
 */
export async function createRecord(input: CreateRecordInput): Promise<PrismaDataRecord> {
  const version = input.previousVersionId
    ? await getNextVersion(input.previousVersionId)
    : 1;

  return prisma.dataRecord.create({
    data: {
      vaultId: input.vaultId,
      type: input.type,
      encryptedPayload: input.encryptedPayload,
      metadata: input.metadata || {},
      version,
      previousVersionId: input.previousVersionId,
      checksum: input.checksum,
    },
  });
}

/**
 * Get record by ID
 */
export async function getRecordById(recordId: string): Promise<PrismaDataRecord | null> {
  return prisma.dataRecord.findUnique({
    where: { id: recordId },
    include: {
      previousVersion: true,
      nextVersions: {
        where: { deletedAt: null },
      },
    },
  });
}

/**
 * Get records by vault ID
 */
export async function getRecordsByVaultId(
  vaultId: string,
  options?: {
    type?: DataRecordType;
    includeDeleted?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<PrismaDataRecord[]> {
  const where: any = {
    vaultId,
    ...(options?.type && { type: options.type }),
    ...(options?.includeDeleted ? {} : { deletedAt: null }),
  };

  return prisma.dataRecord.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options?.limit,
    skip: options?.offset,
  });
}

/**
 * Update record
 */
export async function updateRecord(
  recordId: string,
  input: UpdateRecordInput
): Promise<PrismaDataRecord> {
  return prisma.dataRecord.update({
    where: { id: recordId },
    data: input,
  });
}

/**
 * Create a new version of a record
 */
export async function createRecordVersion(
  recordId: string,
  input: Omit<CreateRecordInput, 'vaultId' | 'previousVersionId'>
): Promise<PrismaDataRecord> {
  const existing = await getRecordById(recordId);
  if (!existing) {
    throw new Error('Record not found');
  }

  return createRecord({
    ...input,
    vaultId: existing.vaultId,
    previousVersionId: recordId,
  });
}

/**
 * Soft delete record
 */
export async function deleteRecord(recordId: string): Promise<void> {
  await prisma.dataRecord.update({
    where: { id: recordId },
    data: {
      deletedAt: new Date(),
    },
  });
}

/**
 * Get version history for a record
 */
export async function getRecordVersionHistory(recordId: string): Promise<PrismaDataRecord[]> {
  const record = await getRecordById(recordId);
  if (!record) {
    return [];
  }

  const history: PrismaDataRecord[] = [];
  let current: PrismaDataRecord | null = record;

  // Traverse backwards through previous versions
  while (current) {
    history.unshift(current);
    if (current.previousVersionId) {
      current = await getRecordById(current.previousVersionId);
    } else {
      current = null;
    }
  }

  return history;
}

/**
 * Get next version number for a record
 */
async function getNextVersion(previousVersionId: string): Promise<number> {
  const previous = await getRecordById(previousVersionId);
  if (!previous) {
    throw new Error('Previous version not found');
  }
  return previous.version + 1;
}

/**
 * Search records by metadata
 */
export async function searchRecordsByMetadata(
  vaultId: string,
  metadataQuery: Record<string, any>
): Promise<PrismaDataRecord[]> {
  // Prisma doesn't support complex JSON queries directly,
  // so we fetch and filter in memory for now
  // In production, consider using PostgreSQL JSONB operators
  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });

  return records.filter((record) => {
    if (!record.metadata) return false;

    const metadata = record.metadata as Record<string, any>;
    return Object.entries(metadataQuery).every(([key, value]) => {
      return metadata[key] === value;
    });
  });
}
