/**
 * B150A-RET-007: Retention policy enforcer job (delete or anonymize aged-out data)
 *
 * Reads retention.yaml; deletes or anonymizes records past TTL;
 * logs counts per table; dry-run mode for testing
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import {
  getRetentionDays,
  getRetentionCutoffDate,
  DEMO_RETENTION_DAYS,
  PROD_RETENTION_DAYS,
  LOG_RETENTION_DAYS,
  AUDIT_RETENTION_DAYS,
} from '../../services/config/retention';
import { ErasureEngine } from '../../services/privacy/erasureEngine';
import {
  anonymizeName,
  anonymizeEmail,
  anonymizePhone,
  anonymizeFreeText,
} from '../../services/privacy/anonymize';

interface RetentionPolicy {
  tables: {
    [tableName: string]: {
      ttlDays: number;
      action: 'delete' | 'anonymize' | 'archive';
      dateField: string;
    };
  };
  defaultTTLDays: number;
  defaultAction: 'delete' | 'anonymize' | 'archive';
}

interface RetentionResult {
  table: string;
  action: string;
  recordsProcessed: number;
  errors: Array<{ recordId?: string; error: string }>;
  duration: number; // milliseconds
}

export class RetentionEnforcer {
  constructor(
    private prisma: PrismaClient,
    private erasureEngine: ErasureEngine,
    private dryRun: boolean = false
  ) {}

  /**
   * Load retention policy from YAML file or use defaults
   */
  async loadRetentionPolicy(configPath?: string): Promise<RetentionPolicy> {
    try {
      const path = configPath || join(process.cwd(), 'config', 'retention.yaml');
      const fileContents = readFileSync(path, 'utf-8');
      const policy = yaml.load(fileContents) as RetentionPolicy;
      return policy;
    } catch (error) {
      console.warn('Failed to load retention.yaml, using defaults:', error);

      // Default retention policy
      return {
        tables: {
          OtpChallenge: {
            ttlDays: 7, // OTPs expire quickly
            action: 'delete',
            dateField: 'expiresAt',
          },
          PilotSmokeTestLog: {
            ttlDays: getRetentionDays(process.env.NODE_ENV === 'development'),
            action: 'delete',
            dateField: 'timestamp',
          },
          EmailDelivery: {
            ttlDays: LOG_RETENTION_DAYS,
            action: 'delete',
            dateField: 'createdAt',
          },
          Notification: {
            ttlDays: LOG_RETENTION_DAYS,
            action: 'delete',
            dateField: 'createdAt',
          },
          AuditEvent: {
            ttlDays: AUDIT_RETENTION_DAYS,
            action: 'anonymize', // Preserve structure but remove PII
            dateField: 'createdAt',
          },
          AgentRun: {
            ttlDays: LOG_RETENTION_DAYS,
            action: 'anonymize',
            dateField: 'startedAt',
          },
        },
        defaultTTLDays: PROD_RETENTION_DAYS,
        defaultAction: 'delete',
      };
    }
  }

  /**
   * Execute retention policy enforcement
   */
  async execute(policy?: RetentionPolicy): Promise<RetentionResult[]> {
    const retentionPolicy = policy || await this.loadRetentionPolicy();
    const results: RetentionResult[] = [];

    console.log(`[RetentionEnforcer] Starting retention enforcement (dry-run: ${this.dryRun})`);

    for (const [tableName, config] of Object.entries(retentionPolicy.tables)) {
      const result = await this.processTable(tableName, config);
      results.push(result);

      console.log(
        `[RetentionEnforcer] ${tableName}: ${result.action} ${result.recordsProcessed} records ` +
        `(${result.duration}ms)${result.errors.length > 0 ? ` - ${result.errors.length} errors` : ''}`
      );
    }

    const totalProcessed = results.reduce((sum, r) => sum + r.recordsProcessed, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    console.log(
      `[RetentionEnforcer] Completed: ${totalProcessed} records processed, ${totalErrors} errors`
    );

    return results;
  }

  /**
   * Process a single table according to retention policy
   */
  private async processTable(
    tableName: string,
    config: RetentionPolicy['tables'][string]
  ): Promise<RetentionResult> {
    const startTime = Date.now();
    const result: RetentionResult = {
      table: tableName,
      action: config.action,
      recordsProcessed: 0,
      errors: [],
      duration: 0,
    };

    try {
      const cutoffDate = getRetentionCutoffDate(config.ttlDays);

      // Build where clause
      const where: any = {};
      if (config.dateField === 'createdAt') {
        where.createdAt = { lt: cutoffDate };
      } else if (config.dateField === 'updatedAt') {
        where.updatedAt = { lt: cutoffDate };
      } else if (config.dateField === 'expiresAt') {
        where.expiresAt = { lt: cutoffDate };
      } else if (config.dateField === 'timestamp') {
        where.timestamp = { lt: cutoffDate };
      } else if (config.dateField === 'startedAt') {
        where.startedAt = { lt: cutoffDate };
      }

      // Execute based on action
      switch (config.action) {
        case 'delete':
          result.recordsProcessed = await this.deleteRecords(tableName, where);
          break;
        case 'anonymize':
          result.recordsProcessed = await this.anonymizeRecords(tableName, where);
          break;
        case 'archive':
          // Archive functionality would move records to archive table
          result.recordsProcessed = await this.archiveRecords(tableName, where);
          break;
      }
    } catch (error: any) {
      result.errors.push({
        error: error.message || 'Unknown error',
      });
      console.error(`[RetentionEnforcer] Error processing ${tableName}:`, error);
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Delete records from a table
   */
  private async deleteRecords(tableName: string, where: any): Promise<number> {
    if (this.dryRun) {
      // Count records that would be deleted
      const count = await (this.prisma as any)[tableName].count({ where });
      console.log(`[DRY-RUN] Would delete ${count} records from ${tableName}`);
      return count;
    }

    // Delete records
    const result = await (this.prisma as any)[tableName].deleteMany({ where });
    return result.count;
  }

  /**
   * Anonymize records in a table
   */
  private async anonymizeRecords(tableName: string, where: any): Promise<number> {
    if (this.dryRun) {
      const count = await (this.prisma as any)[tableName].count({ where });
      console.log(`[DRY-RUN] Would anonymize ${count} records in ${tableName}`);
      return count;
    }

    // Fetch records to anonymize
    const records = await (this.prisma as any)[tableName].findMany({ where });

    let processed = 0;
    for (const record of records) {
      try {
        const updateData: any = {};

        // Anonymize common fields
        if (record.name) {
          updateData.name = anonymizeName(record.name);
        }
        if (record.email) {
          updateData.email = anonymizeEmail(record.email);
        }
        if (record.phone) {
          updateData.phone = anonymizePhone(record.phone);
        }
        if (record.input) {
          updateData.input = anonymizeFreeText(JSON.stringify(record.input)) as any;
        }
        if (record.output) {
          updateData.output = anonymizeFreeText(JSON.stringify(record.output)) as any;
        }
        if (record.data) {
          updateData.data = anonymizeFreeText(JSON.stringify(record.data)) as any;
        }
        if (record.payload) {
          updateData.payload = anonymizeFreeText(JSON.stringify(record.payload)) as any;
        }

        // Update record
        await (this.prisma as any)[tableName].update({
          where: { id: record.id },
          data: updateData,
        });

        processed++;
      } catch (error: any) {
        console.error(`[RetentionEnforcer] Error anonymizing record ${record.id}:`, error);
      }
    }

    return processed;
  }

  /**
   * Archive records (stub - would move to archive table)
   */
  private async archiveRecords(tableName: string, where: any): Promise<number> {
    if (this.dryRun) {
      const count = await (this.prisma as any)[tableName].count({ where });
      console.log(`[DRY-RUN] Would archive ${count} records from ${tableName}`);
      return count;
    }

    // TODO: Implement archive functionality (move to archive table or export to file)
    // For now, treat as delete
    return this.deleteRecords(tableName, where);
  }
}

/**
 * Main function to run retention enforcer as a job
 */
export async function runRetentionEnforcer(dryRun: boolean = false) {
  const prisma = new PrismaClient();
  const erasureEngine = new ErasureEngine(prisma);
  const enforcer = new RetentionEnforcer(prisma, erasureEngine, dryRun);

  try {
    const results = await enforcer.execute();

    // Log summary
    const summary = {
      timestamp: new Date().toISOString(),
      dryRun,
      results: results.map(r => ({
        table: r.table,
        action: r.action,
        recordsProcessed: r.recordsProcessed,
        duration: r.duration,
        errors: r.errors.length,
      })),
      totalProcessed: results.reduce((sum, r) => sum + r.recordsProcessed, 0),
      totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
    };

    console.log('[RetentionEnforcer] Summary:', JSON.stringify(summary, null, 2));

    // Store summary in database (optional)
    if (!dryRun) {
      await prisma.auditEvent.create({
        data: {
          type: 'RETENTION_ENFORCER_RUN',
          data: summary,
        },
      });
    }

    return summary;
  } catch (error) {
    console.error('[RetentionEnforcer] Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI entry point
if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

  runRetentionEnforcer(dryRun)
    .then(() => {
      console.log('[RetentionEnforcer] Job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[RetentionEnforcer] Job failed:', error);
      process.exit(1);
    });
}

