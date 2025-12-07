/**
 * VaultIntegrityChecker
 * B237A-DP-009: VaultIntegrityChecker
 *
 * Periodically scans vaults to verify encrypted data integrity and detect corruption.
 * Uses checksums/hashes, triggers alerts on anomalies.
 */

import { PrismaClient } from '@prisma/client';
import { getVaultById } from '../models/PersonalDataVault';
import { getRecordsByVaultId } from '../models/DataRecord';
import { getEncryptionService } from './encryptionService';
import { logVaultAccess } from '../audit/vaultAuditLog';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

export interface IntegrityCheckResult {
  vaultId: string;
  status: 'healthy' | 'corrupted' | 'warning';
  checkedAt: Date;
  totalRecords: number;
  corruptedRecords: string[];
  missingChecksums: string[];
  warnings: string[];
}

export interface IntegrityAlert {
  vaultId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recordId?: string;
  detectedAt: Date;
}

/**
 * Check integrity of a single vault
 */
export async function checkVaultIntegrity(
  vaultId: string,
  actorId: string = 'system'
): Promise<IntegrityCheckResult> {
  const vault = await getVaultById(vaultId);
  if (!vault) {
    throw new Error('Vault not found');
  }

  const records = await getRecordsByVaultId(vaultId, { includeDeleted: false });
  const corruptedRecords: string[] = [];
  const missingChecksums: string[] = [];
  const warnings: string[] = [];

  const encryptionService = getEncryptionService();

  for (const record of records) {
    // Check if checksum exists
    if (!record.checksum) {
      missingChecksums.push(record.id);
      warnings.push(`Record ${record.id} missing checksum`);
      continue;
    }

    // Verify checksum
    try {
      // Deserialize encrypted data
      const encryptedData = encryptionService.deserializeEncryptedData(
        record.encryptedPayload
      );

      // Calculate expected checksum
      const expectedChecksum = encryptionService.calculateChecksum(encryptedData);

      if (expectedChecksum !== record.checksum) {
        corruptedRecords.push(record.id);
        warnings.push(`Record ${record.id} checksum mismatch`);
      }
    } catch (error) {
      corruptedRecords.push(record.id);
      warnings.push(`Record ${record.id} deserialization failed: ${error}`);
    }
  }

  // Check vault size consistency
  const calculatedSize = records.reduce(
    (sum, r) => sum + BigInt(r.encryptedPayload.length),
    BigInt(0)
  );

  if (calculatedSize !== vault.sizeBytes) {
    warnings.push(
      `Vault size mismatch: stored ${vault.sizeBytes}, calculated ${calculatedSize}`
    );
  }

  const status =
    corruptedRecords.length > 0
      ? 'corrupted'
      : missingChecksums.length > 0 || warnings.length > 0
      ? 'warning'
      : 'healthy';

  // Log integrity check
  await logVaultAccess({
    vaultId,
    actorId,
    action: 'integrity_check',
    scope: 'read:all',
    metadata: {
      status,
      totalRecords: records.length,
      corruptedCount: corruptedRecords.length,
      missingChecksumCount: missingChecksums.length,
      warningCount: warnings.length,
    },
  });

  return {
    vaultId,
    status,
    checkedAt: new Date(),
    totalRecords: records.length,
    corruptedRecords,
    missingChecksums,
    warnings,
  };
}

/**
 * Check integrity of all vaults
 */
export async function checkAllVaultsIntegrity(
  batchSize: number = 100
): Promise<IntegrityCheckResult[]> {
  const vaults = await prisma.personalDataVault.findMany({
    select: { id: true },
    take: batchSize,
  });

  const results: IntegrityCheckResult[] = [];

  for (const vault of vaults) {
    try {
      const result = await checkVaultIntegrity(vault.id);
      results.push(result);
    } catch (error) {
      console.error(`Integrity check failed for vault ${vault.id}:`, error);
      results.push({
        vaultId: vault.id,
        status: 'corrupted',
        checkedAt: new Date(),
        totalRecords: 0,
        corruptedRecords: [],
        missingChecksums: [],
        warnings: [`Check failed: ${error}`],
      });
    }
  }

  return results;
}

/**
 * Generate integrity alerts for corrupted vaults
 */
export async function generateIntegrityAlerts(
  results: IntegrityCheckResult[]
): Promise<IntegrityAlert[]> {
  const alerts: IntegrityAlert[] = [];

  for (const result of results) {
    if (result.status === 'corrupted') {
      // Critical: corrupted records
      for (const recordId of result.corruptedRecords) {
        alerts.push({
          vaultId: result.vaultId,
          severity: 'critical',
          message: `Record ${recordId} is corrupted (checksum mismatch)`,
          recordId,
          detectedAt: result.checkedAt,
        });
      }

      // High: multiple corrupted records
      if (result.corruptedRecords.length > 5) {
        alerts.push({
          vaultId: result.vaultId,
          severity: 'high',
          message: `${result.corruptedRecords.length} records are corrupted`,
          detectedAt: result.checkedAt,
        });
      }
    }

    if (result.status === 'warning') {
      // Medium: missing checksums
      if (result.missingChecksums.length > 0) {
        alerts.push({
          vaultId: result.vaultId,
          severity: 'medium',
          message: `${result.missingChecksums.length} records missing checksums`,
          detectedAt: result.checkedAt,
        });
      }

      // Low: warnings
      if (result.warnings.length > 0 && result.corruptedRecords.length === 0) {
        alerts.push({
          vaultId: result.vaultId,
          severity: 'low',
          message: `${result.warnings.length} integrity warnings`,
          detectedAt: result.checkedAt,
        });
      }
    }
  }

  return alerts;
}

/**
 * Repair corrupted record (attempt to recover or mark for deletion)
 */
export async function repairCorruptedRecord(
  recordId: string,
  actorId: string = 'system'
): Promise<{ repaired: boolean; action: string }> {
  const record = await prisma.dataRecord.findUnique({
    where: { id: recordId },
  });

  if (!record) {
    throw new Error('Record not found');
  }

  // Try to deserialize and verify
  const encryptionService = getEncryptionService();
  try {
    const encryptedData = encryptionService.deserializeEncryptedData(
      record.encryptedPayload
    );

    // If deserialization succeeds, recalculate checksum
    const newChecksum = encryptionService.calculateChecksum(encryptedData);

    await prisma.dataRecord.update({
      where: { id: recordId },
      data: { checksum: newChecksum },
    });

    await logVaultAccess({
      vaultId: record.vaultId,
      actorId,
      action: 'repair_record',
      recordId,
      scope: 'write:all',
      metadata: { action: 'checksum_recalculated' },
    });

    return { repaired: true, action: 'checksum_recalculated' };
  } catch (error) {
    // Mark as corrupted in metadata
    await prisma.dataRecord.update({
      where: { id: recordId },
      data: {
        metadata: {
          ...((record.metadata as any) || {}),
          corrupted: true,
          corruptedAt: new Date().toISOString(),
          corruptionError: String(error),
        },
      },
    });

    await logVaultAccess({
      vaultId: record.vaultId,
      actorId,
      action: 'mark_corrupted',
      recordId,
      scope: 'write:all',
      metadata: { error: String(error) },
    });

    return { repaired: false, action: 'marked_corrupted' };
  }
}

/**
 * Schedule periodic integrity checks (to be called by cron job)
 */
export async function scheduleIntegrityChecks(
  intervalHours: number = 24
): Promise<void> {
  // In production, this would be called by a cron job
  // For now, it's a placeholder
  console.log(`Scheduling integrity checks every ${intervalHours} hours`);
}
