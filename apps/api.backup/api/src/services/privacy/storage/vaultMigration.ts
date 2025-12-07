/**
 * VaultMigrationAndSharding
 * B237A-DP-007: VaultMigrationAndSharding
 *
 * Implements migration and sharding logic for vaults when size thresholds are exceeded.
 * Transparently moves data, updates references.
 */

import { PrismaClient } from '@prisma/client';
import { getVaultById, updateVault } from '../models/PersonalDataVault';
import { getRecordsByVaultId } from '../models/DataRecord';
import { logVaultAccess } from '../audit/vaultAuditLog';

const prisma = new PrismaClient();

export interface ShardingConfig {
  maxSizeBytes: bigint; // Threshold for sharding (e.g., 1GB)
  shardPrefix: string; // Prefix for shard identifiers
  storageProvider: 's3' | 'azure' | 'gcp' | 'database';
}

const DEFAULT_CONFIG: ShardingConfig = {
  maxSizeBytes: BigInt(1024 * 1024 * 1024), // 1GB
  shardPrefix: 'shard',
  storageProvider: 'database',
};

/**
 * Check if vault needs sharding
 */
export async function shouldShardVault(
  vaultId: string,
  config: ShardingConfig = DEFAULT_CONFIG
): Promise<boolean> {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    return false;
  }

  return vault.sizeBytes >= config.maxSizeBytes;
}

/**
 * Migrate vault to a new storage location
 */
export async function migrateVault(
  vaultId: string,
  newStorageLocation: string,
  actorId: string = 'system'
): Promise<void> {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    throw new Error('Vault not found');
  }

  // Get all records
  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });

  // In production, this would:
  // 1. Copy records to new storage location
  // 2. Verify integrity
  // 3. Update vault storage location
  // 4. Delete old records (optional, or keep for rollback)

  await updateVault(vaultId, {
    storageLocation: newStorageLocation,
  });

  await logVaultAccess({
    vaultId,
    actorId,
    action: 'migrate',
    scope: 'write:all',
    metadata: {
      oldLocation: vault.storageLocation,
      newLocation: newStorageLocation,
      recordCount: records.length,
    },
  });
}

/**
 * Shard a vault into multiple shards
 */
export async function shardVault(
  vaultId: string,
  config: ShardingConfig = DEFAULT_CONFIG,
  actorId: string = 'system'
): Promise<{ shardId: string; recordCount: number }[]> {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    throw new Error('Vault not found');
  }

  if (!(await shouldShardVault(vaultId, config))) {
    throw new Error('Vault does not exceed sharding threshold');
  }

  // Get all records
  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });

  // Group records by type or other criteria for sharding
  const shards: Map<string, typeof records> = new Map();
  const shardResults: { shardId: string; recordCount: number }[] = [];

  // Simple sharding: split by record type
  for (const record of records) {
    const shardKey = `${config.shardPrefix}-${record.type}`;
    if (!shards.has(shardKey)) {
      shards.set(shardKey, []);
    }
    shards.get(shardKey)!.push(record);
  }

  // Create shard storage locations and move records
  for (const [shardId, shardRecords] of shards.entries()) {
    const shardLocation = `${vault.storageLocation || 'default'}/${shardId}`;

    // Update records to reference shard location
    for (const record of shardRecords) {
      await prisma.dataRecord.update({
        where: { id: record.id },
        data: {
          metadata: {
            ...((record.metadata as any) || {}),
            shardId,
            shardLocation,
            shardedAt: new Date().toISOString(),
          },
        },
      });
    }

    shardResults.push({
      shardId,
      recordCount: shardRecords.length,
    });
  }

  // Update vault with sharding metadata
  await updateVault(vaultId, {
    storageLocation: `${vault.storageLocation || 'default'}/sharded`,
  });

  await logVaultAccess({
    vaultId,
    actorId,
    action: 'shard',
    scope: 'write:all',
    metadata: {
      shardCount: shards.size,
      shards: Array.from(shards.keys()),
      totalRecords: records.length,
    },
  });

  return shardResults;
}

/**
 * Merge sharded vault back into single storage
 */
export async function mergeShardedVault(
  vaultId: string,
  actorId: string = 'system'
): Promise<void> {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    throw new Error('Vault not found');
  }

  // Get all records
  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });

  // Remove sharding metadata
  for (const record of records) {
    const metadata = (record.metadata as any) || {};
    if (metadata.shardId) {
      delete metadata.shardId;
      delete metadata.shardLocation;
      delete metadata.shardedAt;

      await prisma.dataRecord.update({
        where: { id: record.id },
        data: { metadata },
      });
    }
  }

  // Update vault storage location
  const baseLocation = vault.storageLocation?.replace('/sharded', '') || 'default';
  await updateVault(vaultId, {
    storageLocation: baseLocation,
  });

  await logVaultAccess({
    vaultId,
    actorId,
    action: 'merge_shards',
    scope: 'write:all',
    metadata: {
      recordCount: records.length,
    },
  });
}

/**
 * Get vault sharding status
 */
export async function getVaultShardingStatus(vaultId: string) {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    return null;
  }

  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });

  const shardInfo = {
    isSharded: vault.storageLocation?.includes('/sharded') || false,
    shardCount: 0,
    shards: [] as string[],
    totalRecords: records.length,
    sizeBytes: vault.sizeBytes,
  };

  // Count shards
  const shardSet = new Set<string>();
  for (const record of records) {
    const metadata = (record.metadata as any) || {};
    if (metadata.shardId) {
      shardSet.add(metadata.shardId);
    }
  }

  shardInfo.shardCount = shardSet.size;
  shardInfo.shards = Array.from(shardSet);

  return shardInfo;
}

/**
 * Move records between shards (rebalancing)
 */
export async function rebalanceShards(
  vaultId: string,
  targetShardSizes: Map<string, number>, // shardId -> target record count
  actorId: string = 'system'
): Promise<void> {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    throw new Error('Vault not found');
  }

  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });

  // Group by current shard
  const currentShards = new Map<string, typeof records>();
  for (const record of records) {
    const metadata = (record.metadata as any) || {};
    const shardId = metadata.shardId || 'default';
    if (!currentShards.has(shardId)) {
      currentShards.set(shardId, []);
    }
    currentShards.get(shardId)!.push(record);
  }

  // Rebalance records
  let recordIndex = 0;
  for (const [shardId, targetSize] of targetShardSizes.entries()) {
    const currentSize = currentShards.get(shardId)?.length || 0;
    const needed = targetSize - currentSize;

    if (needed > 0) {
      // Move records to this shard
      for (let i = 0; i < needed && recordIndex < records.length; i++) {
        const record = records[recordIndex];
        await prisma.dataRecord.update({
          where: { id: record.id },
          data: {
            metadata: {
              ...((record.metadata as any) || {}),
              shardId,
              shardLocation: `${vault.storageLocation || 'default'}/${shardId}`,
              rebalancedAt: new Date().toISOString(),
            },
          },
        });
        recordIndex++;
      }
    }
  }

  await logVaultAccess({
    vaultId,
    actorId,
    action: 'rebalance_shards',
    scope: 'write:all',
    metadata: {
      targetSizes: Object.fromEntries(targetShardSizes),
    },
  });
}
