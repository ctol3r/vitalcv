/**
 * DataRetentionPolicyEngine
 * B237A-DP-005: DataRetentionPolicyEngine
 *
 * Evaluates and enforces data retention rules for records.
 * Auto-delete or archive after configured period. Supports per-type policies.
 * Records deletions in audit log.
 */

import { PrismaClient, DataRecordType } from '@prisma/client';
import { logVaultAccess } from '../audit/vaultAuditLog';
import { deleteRecord } from '../models/DataRecord';

const prisma = new PrismaClient();

export interface RetentionPolicy {
  recordType: DataRecordType | 'all';
  retentionDays: number;
  action: 'delete' | 'archive';
  enabled: boolean;
}

export interface RetentionResult {
  recordId: string;
  action: 'deleted' | 'archived' | 'skipped';
  reason?: string;
}

/**
 * Default retention policies (in days)
 */
const DEFAULT_POLICIES: RetentionPolicy[] = [
  { recordType: 'log', retentionDays: 90, action: 'delete', enabled: true },
  { recordType: 'credential', retentionDays: 2555, action: 'archive', enabled: true }, // 7 years
  { recordType: 'contract', retentionDays: 2555, action: 'archive', enabled: true }, // 7 years
  { recordType: 'profile', retentionDays: 3650, action: 'archive', enabled: true }, // 10 years
];

/**
 * Evaluate and enforce retention policies for a vault
 */
export async function enforceRetentionPolicies(
  vaultId: string,
  policies: RetentionPolicy[] = DEFAULT_POLICIES,
  actorId: string = 'system'
): Promise<RetentionResult[]> {
  const results: RetentionResult[] = [];
  const now = new Date();

  // Get all non-deleted records
  const records = await prisma.dataRecord.findMany({
    where: {
      vaultId,
      deletedAt: null,
    },
  });

  for (const record of records) {
    // Find applicable policy
    const policy = policies.find(
      (p) =>
        p.enabled &&
        (p.recordType === 'all' || p.recordType === record.type)
    );

    if (!policy) {
      results.push({
        recordId: record.id,
        action: 'skipped',
        reason: 'No policy applicable',
      });
      continue;
    }

    // Calculate age
    const ageDays = Math.floor(
      (now.getTime() - record.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (ageDays >= policy.retentionDays) {
      if (policy.action === 'delete') {
        // Soft delete
        await deleteRecord(record.id);

        // Log deletion
        await logVaultAccess({
          vaultId,
          actorId,
          action: 'delete',
          recordId: record.id,
          scope: `delete:${record.type}`,
          metadata: {
            reason: 'retention_policy',
            ageDays,
            policy: policy.recordType,
          },
        });

        results.push({
          recordId: record.id,
          action: 'deleted',
          reason: `Retention policy: ${policy.recordType} after ${policy.retentionDays} days`,
        });
      } else if (policy.action === 'archive') {
        // Archive (mark with metadata, could move to cold storage)
        await prisma.dataRecord.update({
          where: { id: record.id },
          data: {
            metadata: {
              ...((record.metadata as any) || {}),
              archived: true,
              archivedAt: now.toISOString(),
              archivedBy: actorId,
            },
          },
        });

        await logVaultAccess({
          vaultId,
          actorId,
          action: 'archive',
          recordId: record.id,
          scope: `archive:${record.type}`,
          metadata: {
            reason: 'retention_policy',
            ageDays,
            policy: policy.recordType,
          },
        });

        results.push({
          recordId: record.id,
          action: 'archived',
          reason: `Retention policy: ${policy.recordType} after ${policy.retentionDays} days`,
        });
      }
    } else {
      results.push({
        recordId: record.id,
        action: 'skipped',
        reason: `Age ${ageDays} days < retention ${policy.retentionDays} days`,
      });
    }
  }

  return results;
}

/**
 * Evaluate retention policies for all vaults
 */
export async function enforceRetentionPoliciesForAllVaults(
  policies: RetentionPolicy[] = DEFAULT_POLICIES,
  batchSize: number = 100
): Promise<{ vaultId: string; results: RetentionResult[] }[]> {
  const vaults = await prisma.personalDataVault.findMany({
    select: { id: true },
    take: batchSize,
  });

  const allResults: { vaultId: string; results: RetentionResult[] }[] = [];

  for (const vault of vaults) {
    const results = await enforceRetentionPolicies(vault.id, policies);
    allResults.push({ vaultId: vault.id, results });
  }

  return allResults;
}

/**
 * Get records that will expire soon (for notification)
 */
export async function getExpiringRecords(
  vaultId: string,
  daysAhead: number = 30,
  policies: RetentionPolicy[] = DEFAULT_POLICIES
) {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const records = await prisma.dataRecord.findMany({
    where: {
      vaultId,
      deletedAt: null,
    },
  });

  const expiring: Array<{
    recordId: string;
    type: DataRecordType;
    expiresAt: Date;
    action: 'delete' | 'archive';
  }> = [];

  for (const record of records) {
    const policy = policies.find(
      (p) =>
        p.enabled &&
        (p.recordType === 'all' || p.recordType === record.type)
    );

    if (!policy) continue;

    const expiresAt = new Date(
      record.createdAt.getTime() + policy.retentionDays * 24 * 60 * 60 * 1000
    );

    if (expiresAt <= thresholdDate) {
      expiring.push({
        recordId: record.id,
        type: record.type,
        expiresAt,
        action: policy.action,
      });
    }
  }

  return expiring.sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime());
}

/**
 * Custom retention policy for a specific record type
 */
export async function setCustomRetentionPolicy(
  vaultId: string,
  policy: RetentionPolicy
): Promise<void> {
  // In production, store custom policies in database
  // For now, this is a placeholder
  console.log(`Custom retention policy set for vault ${vaultId}:`, policy);
}
