const log = getServiceLogger('directory/regionSync');
/**
 * B139A-INTL-007: Cross-Region Directory Sync
 *
 * Synchronizes non-PHI provider directory data across regions.
 * Enables provider searches without moving sensitive PHI data.
 *
 * Key principles:
 * - Only non-PHI fields are synchronized
 * - Uses hashed identifiers (SHA-256) for provider IDs
 * - Logs detailed statistics per sync run
 * - Differential sync (only changed records)
 */

import crypto from 'crypto';
import { Region } from '../org/models/TenantRegion';
import { canSyncAcrossRegions } from '../security/regionGuard';
import { getServiceLogger } from '../logging/serviceLogger';

/**
 * Provider directory record (non-PHI only)
 */
export interface ProviderDirectoryRecord {
  providerHash: string; // SHA-256(NPI or unique identifier)
  displayName: string;
  specialty?: string;
  licenseStates: string[]; // US state codes or country codes
  compactStatus?: string; // IMLC_ACTIVE, PSYPACT_ACTIVE, etc.
  certifications?: string[];
  languages?: string[];
  regionSource: Region;
  lastUpdated: Date;
}

/**
 * Sync configuration
 */
export interface SyncConfig {
  sourceRegion: Region;
  targetRegions: Region[];
  batchSize: number;
  includeInactive: boolean;
}

/**
 * Sync statistics
 */
export interface SyncStats {
  runId: string;
  startTime: Date;
  endTime?: Date;
  sourceRegion: Region;
  targetRegion: Region;
  recordsScanned: number;
  recordsUpdated: number;
  recordsInserted: number;
  recordsDeleted: number;
  recordsSkipped: number;
  errors: number;
  errorDetails: Array<{ record: string; error: string }>;
}

/**
 * Sync run log
 */
const syncLogs: SyncStats[] = [];

/**
 * Generate provider hash from identifier
 *
 * @param identifier Provider unique identifier (NPI, license number, etc.)
 * @returns SHA-256 hash
 */
export function hashProviderId(identifier: string): string {
  return crypto.createHash('sha256').update(identifier).digest('hex');
}

/**
 * Sanitize provider record for cross-region sync
 * Removes any potentially identifying information beyond what's public
 */
export function sanitizeProviderRecord(record: any): ProviderDirectoryRecord {
  return {
    providerHash: hashProviderId(record.id || record.npi || record.providerId),
    displayName: record.displayName || `${record.firstName || ''} ${record.lastName || ''}`.trim(),
    specialty: record.specialty,
    licenseStates: Array.isArray(record.licenseStates) ? record.licenseStates : [],
    compactStatus: record.compactStatus,
    certifications: Array.isArray(record.certifications) ? record.certifications : [],
    languages: Array.isArray(record.languages) ? record.languages : [],
    regionSource: record.regionSource || Region.US,
    lastUpdated: record.lastUpdated || new Date(),
  };
}

/**
 * Fetch providers from source region
 * In production, this would query the regional database
 */
export async function fetchProvidersFromRegion(
  region: Region,
  lastSyncTime?: Date,
  batchSize: number = 1000
): Promise<ProviderDirectoryRecord[]> {
  // Placeholder: In production, query regional database
  // SELECT * FROM providers WHERE region = $1 AND updated_at > $2 LIMIT $3

  log.info(`Fetching providers from ${region} since ${lastSyncTime || 'never'} (batch size: ${batchSize})`);

  // For testing, return empty array
  return [];
}

/**
 * Sync providers to target region
 * In production, this would insert/update in target region's directory replica
 */
export async function syncProvidersToRegion(
  providers: ProviderDirectoryRecord[],
  targetRegion: Region
): Promise<{ inserted: number; updated: number; errors: number }> {
  let inserted = 0;
  let updated = 0;
  let errors = 0;

  for (const provider of providers) {
    try {
      // Placeholder: In production, upsert to target region directory
      // INSERT INTO directory_replica (provider_hash, display_name, ...)
      // VALUES ($1, $2, ...)
      // ON CONFLICT (provider_hash) DO UPDATE SET ...

      // For now, just count
      if (Math.random() > 0.5) {
        updated++;
      } else {
        inserted++;
      }
    } catch (error) {
      errors++;
      log.error(`Error syncing provider ${provider.providerHash} to ${targetRegion}:`, error);
    }
  }

  return { inserted, updated, errors };
}

/**
 * Perform differential sync from source to target region
 */
export async function syncRegion(
  sourceRegion: Region,
  targetRegion: Region,
  lastSyncTime?: Date,
  batchSize: number = 1000
): Promise<SyncStats> {
  const runId = crypto.randomUUID();
  const stats: SyncStats = {
    runId,
    startTime: new Date(),
    sourceRegion,
    targetRegion,
    recordsScanned: 0,
    recordsUpdated: 0,
    recordsInserted: 0,
    recordsDeleted: 0,
    recordsSkipped: 0,
    errors: 0,
    errorDetails: [],
  };

  try {
    log.info(`[SYNC ${runId}] Starting sync: ${sourceRegion} → ${targetRegion}`);

    // 1. Fetch changed providers from source region
    const providers = await fetchProvidersFromRegion(sourceRegion, lastSyncTime, batchSize);
    stats.recordsScanned = providers.length;

    if (providers.length === 0) {
      log.info(`[SYNC ${runId}] No changes to sync`);
      stats.endTime = new Date();
      syncLogs.push(stats);
      return stats;
    }

    // 2. Sanitize records
    const sanitized = providers.map(p => sanitizeProviderRecord(p));

    // 3. Sync to target region
    const syncResult = await syncProvidersToRegion(sanitized, targetRegion);
    stats.recordsInserted = syncResult.inserted;
    stats.recordsUpdated = syncResult.updated;
    stats.errors = syncResult.errors;

    // 4. Complete
    stats.endTime = new Date();
    const duration = stats.endTime.getTime() - stats.startTime.getTime();

    log.info(`[SYNC ${runId}] Complete in ${duration}ms:`, {
      scanned: stats.recordsScanned,
      inserted: stats.recordsInserted,
      updated: stats.recordsUpdated,
      errors: stats.errors,
    });

    syncLogs.push(stats);
    return stats;
  } catch (error) {
    stats.endTime = new Date();
    stats.errors++;
    stats.errorDetails.push({
      record: 'sync_operation',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    log.error(`[SYNC ${runId}] Failed:`, error);
    syncLogs.push(stats);

    throw error;
  }
}

/**
 * Sync from one source region to multiple target regions
 */
export async function syncToMultipleRegions(
  config: SyncConfig
): Promise<SyncStats[]> {
  const results: SyncStats[] = [];

  for (const targetRegion of config.targetRegions) {
    if (targetRegion === config.sourceRegion) {
      log.warn(`Skipping self-sync: ${config.sourceRegion} → ${targetRegion}`);
      continue;
    }

    try {
      const stats = await syncRegion(
        config.sourceRegion,
        targetRegion,
        undefined, // lastSyncTime would come from state
        config.batchSize
      );
      results.push(stats);
    } catch (error) {
      log.error(`Failed to sync ${config.sourceRegion} → ${targetRegion}:`, error);
      // Continue with other regions
    }
  }

  return results;
}

/**
 * Bi-directional sync between all regions
 */
export async function syncAllRegions(
  regions: Region[] = [Region.US, Region.EU, Region.AU],
  batchSize: number = 1000
): Promise<SyncStats[]> {
  const allStats: SyncStats[] = [];

  for (const sourceRegion of regions) {
    const targetRegions = regions.filter(r => r !== sourceRegion);

    const stats = await syncToMultipleRegions({
      sourceRegion,
      targetRegions,
      batchSize,
      includeInactive: false,
    });

    allStats.push(...stats);
  }

  return allStats;
}

/**
 * Get sync logs
 */
export function getSyncLogs(filters?: {
  sourceRegion?: Region;
  targetRegion?: Region;
  startDate?: Date;
  endDate?: Date;
}): SyncStats[] {
  let filtered = [...syncLogs];

  if (filters) {
    if (filters.sourceRegion) {
      filtered = filtered.filter(log => log.sourceRegion === filters.sourceRegion);
    }
    if (filters.targetRegion) {
      filtered = filtered.filter(log => log.targetRegion === filters.targetRegion);
    }
    if (filters.startDate) {
      filtered = filtered.filter(log => log.startTime >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => log.startTime <= filters.endDate!);
    }
  }

  return filtered;
}

/**
 * Clear sync logs (for testing)
 */
export function clearSyncLogs(): void {
  syncLogs.length = 0;
}

/**
 * Get sync metrics
 */
export interface SyncMetrics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalRecordsScanned: number;
  totalRecordsInserted: number;
  totalRecordsUpdated: number;
  totalErrors: number;
  averageDuration: number;
  bySourceRegion: Record<Region, {
    runs: number;
    recordsScanned: number;
    recordsInserted: number;
    recordsUpdated: number;
    errors: number;
  }>;
}

export function getSyncMetrics(): SyncMetrics {
  const metrics: SyncMetrics = {
    totalRuns: syncLogs.length,
    successfulRuns: 0,
    failedRuns: 0,
    totalRecordsScanned: 0,
    totalRecordsInserted: 0,
    totalRecordsUpdated: 0,
    totalErrors: 0,
    averageDuration: 0,
    bySourceRegion: {
      [Region.US]: { runs: 0, recordsScanned: 0, recordsInserted: 0, recordsUpdated: 0, errors: 0 },
      [Region.EU]: { runs: 0, recordsScanned: 0, recordsInserted: 0, recordsUpdated: 0, errors: 0 },
      [Region.AU]: { runs: 0, recordsScanned: 0, recordsInserted: 0, recordsUpdated: 0, errors: 0 },
    },
  };

  let totalDuration = 0;

  for (const log of syncLogs) {
    if (log.errors === 0) {
      metrics.successfulRuns++;
    } else {
      metrics.failedRuns++;
    }

    metrics.totalRecordsScanned += log.recordsScanned;
    metrics.totalRecordsInserted += log.recordsInserted;
    metrics.totalRecordsUpdated += log.recordsUpdated;
    metrics.totalErrors += log.errors;

    // Duration
    if (log.endTime) {
      totalDuration += log.endTime.getTime() - log.startTime.getTime();
    }

    // By source region
    const sourceStats = metrics.bySourceRegion[log.sourceRegion];
    sourceStats.runs++;
    sourceStats.recordsScanned += log.recordsScanned;
    sourceStats.recordsInserted += log.recordsInserted;
    sourceStats.recordsUpdated += log.recordsUpdated;
    sourceStats.errors += log.errors;
  }

  metrics.averageDuration = syncLogs.length > 0 ? totalDuration / syncLogs.length : 0;

  return metrics;
}

/**
 * Scheduled sync job
 * Run this on a cron schedule (e.g., hourly)
 */
export async function scheduledSync(): Promise<void> {
  log.info('[SCHEDULED_SYNC] Starting scheduled cross-region directory sync');

  try {
    const stats = await syncAllRegions([Region.US, Region.EU, Region.AU], 1000);

    const totalInserted = stats.reduce((sum, s) => sum + s.recordsInserted, 0);
    const totalUpdated = stats.reduce((sum, s) => sum + s.recordsUpdated, 0);
    const totalErrors = stats.reduce((sum, s) => sum + s.errors, 0);

    log.info('[SCHEDULED_SYNC] Complete:', {
      runs: stats.length,
      inserted: totalInserted,
      updated: totalUpdated,
      errors: totalErrors,
    });
  } catch (error) {
    log.error('[SCHEDULED_SYNC] Failed:', error);
    throw error;
  }
}

/**
 * Example usage documentation
 */
export const USAGE_EXAMPLES = `
# Cross-Region Directory Sync Usage Examples

## Sync from US to EU

\`\`\`typescript
import { syncRegion, Region } from './regionSync';

const stats = await syncRegion(
  Region.US,    // source
  Region.EU,    // target
  new Date('2025-11-01'), // only records changed since this date
  1000          // batch size
);

log.info('Sync stats:', {
  scanned: stats.recordsScanned,
  inserted: stats.recordsInserted,
  updated: stats.recordsUpdated,
  errors: stats.errors,
});
\`\`\`

## Sync to multiple regions

\`\`\`typescript
import { syncToMultipleRegions, Region } from './regionSync';

const results = await syncToMultipleRegions({
  sourceRegion: Region.US,
  targetRegions: [Region.EU, Region.AU],
  batchSize: 1000,
  includeInactive: false,
});

for (const stats of results) {
  log.info(\`\${stats.sourceRegion} → \${stats.targetRegion}: \${stats.recordsInserted} inserted, \${stats.recordsUpdated} updated\`);
}
\`\`\`

## Bi-directional sync across all regions

\`\`\`typescript
import { syncAllRegions } from './regionSync';

const stats = await syncAllRegions();

log.info(\`Synced across all regions: \${stats.length} runs\`);
\`\`\`

## Hash provider ID

\`\`\`typescript
import { hashProviderId } from './regionSync';

const npi = '1234567890';
const hash = hashProviderId(npi);
log.info('Provider hash:', hash);
// Output: SHA-256 hash (64 hex characters)
\`\`\`

## Scheduled sync job (cron)

\`\`\`typescript
import { scheduledSync } from './regionSync';
import cron from 'node-cron';

// Run every hour
cron.schedule('0 * * * *', async () => {
  await scheduledSync();
});
\`\`\`

## Get sync metrics

\`\`\`typescript
import { getSyncMetrics } from './regionSync';

const metrics = getSyncMetrics();

log.info('Total sync runs:', metrics.totalRuns);
log.info('Average duration:', metrics.averageDuration, 'ms');
log.info('US region syncs:', metrics.bySourceRegion[Region.US].runs);
\`\`\`
`;

