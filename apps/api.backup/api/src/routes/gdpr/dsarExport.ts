/**
 * B139A-COMPLIANCE-008: GDPR Data Subject Access Request (DSAR) Regionalization
 *
 * Handles GDPR Article 15 Data Subject Access Requests with multi-region awareness.
 * Only exports data from tenant's allowedRegions.
 */

import { Request, Response } from 'express';
import { Region } from '../../../../../services/org/models/TenantRegion';
import archiver from 'archiver';
import crypto from 'crypto';

/**
 * DSAR export request
 */
export interface DsarRequest {
  subjectId: string; // Patient or provider ID
  subjectType: 'patient' | 'provider' | 'user';
  tenantId: string;
  requestedBy: string;
  purpose: string;
  includeMetadata: boolean;
}

/**
 * DSAR export metadata
 */
export interface DsarExportMetadata {
  exportId: string;
  requestDate: Date;
  completionDate: Date;
  subjectId: string;
  subjectType: string;
  tenantId: string;
  regionsQueried: Region[];
  recordCounts: Record<string, number>;
  checksums: Record<string, string>;
}

/**
 * DSAR audit log
 */
export interface DsarAuditLog {
  timestamp: Date;
  exportId: string;
  tenantId: string;
  subjectId: string;
  subjectType: string;
  region: Region;
  recordCount: number;
  requestedBy: string;
  success: boolean;
  error?: string;
}

const dsarAuditLogs: DsarAuditLog[] = [];

/**
 * Query data from specific region
 */
async function queryRegionData(
  region: Region,
  subjectId: string,
  subjectType: string,
  tenantId: string
): Promise<Record<string, any[]>> {
  // Placeholder: In production, query regional database
  console.log(`Querying region ${region} for ${subjectType} ${subjectId}`);

  return {
    personalInfo: [],
    medicalRecords: [],
    appointments: [],
    prescriptions: [],
    labResults: [],
  };
}

/**
 * Export DSAR data for tenant's allowed regions
 */
export async function exportDsarData(
  request: DsarRequest,
  allowedRegions: Region[]
): Promise<{ metadata: DsarExportMetadata; data: Record<Region, any> }> {
  const exportId = crypto.randomUUID();
  const startTime = new Date();

  const regionData: Record<Region, any> = {} as any;
  const recordCounts: Record<string, number> = {};
  const checksums: Record<string, string> = {};

  console.log(`[DSAR ${exportId}] Starting export for ${request.subjectType} ${request.subjectId}`);
  console.log(`[DSAR ${exportId}] Allowed regions: [${allowedRegions.join(', ')}]`);

  // Query each allowed region
  for (const region of allowedRegions) {
    try {
      console.log(`[DSAR ${exportId}] Querying region: ${region}`);

      const data = await queryRegionData(
        region,
        request.subjectId,
        request.subjectType,
        request.tenantId
      );

      regionData[region] = data;

      // Count records
      const totalRecords = Object.values(data).reduce(
        (sum: number, arr: any[]) => sum + arr.length,
        0
      );

      recordCounts[region] = totalRecords;

      // Generate checksum
      const regionJson = JSON.stringify(data);
      checksums[region] = crypto.createHash('sha256').update(regionJson).digest('hex');

      // Audit log
      dsarAuditLogs.push({
        timestamp: new Date(),
        exportId,
        tenantId: request.tenantId,
        subjectId: request.subjectId,
        subjectType: request.subjectType,
        region,
        recordCount: totalRecords,
        requestedBy: request.requestedBy,
        success: true,
      });

      console.log(`[DSAR ${exportId}] Region ${region}: ${totalRecords} records`);
    } catch (error) {
      console.error(`[DSAR ${exportId}] Error querying region ${region}:`, error);

      dsarAuditLogs.push({
        timestamp: new Date(),
        exportId,
        tenantId: request.tenantId,
        subjectId: request.subjectId,
        subjectType: request.subjectType,
        region,
        recordCount: 0,
        requestedBy: request.requestedBy,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  const metadata: DsarExportMetadata = {
    exportId,
    requestDate: startTime,
    completionDate: new Date(),
    subjectId: request.subjectId,
    subjectType: request.subjectType,
    tenantId: request.tenantId,
    regionsQueried: allowedRegions,
    recordCounts,
    checksums,
  };

  console.log(`[DSAR ${exportId}] Export complete:`, {
    regions: allowedRegions.length,
    totalRecords: Object.values(recordCounts).reduce((sum, count) => sum + count, 0),
  });

  return { metadata, data: regionData };
}

/**
 * Express route handler for DSAR export
 */
export async function handleDsarExport(req: Request, res: Response): Promise<void> {
  try {
    const { subjectId, subjectType } = req.body;

    // Get tenant metadata from request (set by regionRouter middleware)
    const tenantMetadata = (req as any).tenantMetadata;
    if (!tenantMetadata) {
      res.status(400).json({ error: 'Tenant metadata not found' });
      return;
    }

    const userId = (req.user as any)?.userId || 'unknown';

    // Prepare DSAR request
    const dsarRequest: DsarRequest = {
      subjectId,
      subjectType: subjectType || 'patient',
      tenantId: tenantMetadata.tenantId,
      requestedBy: userId,
      purpose: 'GDPR Article 15 Data Subject Access Request',
      includeMetadata: true,
    };

    // Export data from allowed regions
    const { metadata, data } = await exportDsarData(
      dsarRequest,
      tenantMetadata.allowedRegions
    );

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } });

    res.attachment(`dsar-export-${metadata.exportId}.zip`);
    res.setHeader('Content-Type', 'application/zip');

    archive.pipe(res);

    // Add metadata file
    archive.append(JSON.stringify(metadata, null, 2), { name: 'metadata.json' });

    // Add data files per region
    for (const [region, regionData] of Object.entries(data)) {
      archive.append(
        JSON.stringify(regionData, null, 2),
        { name: `data-${region}.json` }
      );
    }

    // Add checksums
    const checksumFile = Object.entries(metadata.checksums)
      .map(([region, checksum]) => `${region}: ${checksum}`)
      .join('\n');
    archive.append(checksumFile, { name: 'checksums.txt' });

    // Finalize archive
    await archive.finalize();

  } catch (error) {
    console.error('DSAR export error:', error);
    res.status(500).json({
      error: 'DSAR export failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Get DSAR audit logs
 */
export function getDsarAuditLogs(filters?: {
  tenantId?: string;
  region?: Region;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
}): DsarAuditLog[] {
  let filtered = [...dsarAuditLogs];

  if (filters) {
    if (filters.tenantId) {
      filtered = filtered.filter(log => log.tenantId === filters.tenantId);
    }
    if (filters.region) {
      filtered = filtered.filter(log => log.region === filters.region);
    }
    if (filters.success !== undefined) {
      filtered = filtered.filter(log => log.success === filters.success);
    }
    if (filters.startDate) {
      filtered = filtered.filter(log => log.timestamp >= filters.startDate!);
    }
    if (filters.endDate) {
      filtered = filtered.filter(log => log.timestamp <= filters.endDate!);
    }
  }

  return filtered;
}

/**
 * Clear DSAR audit logs (for testing)
 */
export function clearDsarAuditLogs(): void {
  dsarAuditLogs.length = 0;
}

/**
 * Get DSAR metrics
 */
export interface DsarMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  byRegion: Record<Region, { requests: number; recordsExported: number }>;
  averageRecords: number;
}

export function getDsarMetrics(): DsarMetrics {
  const metrics: DsarMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    byRegion: {
      [Region.US]: { requests: 0, recordsExported: 0 },
      [Region.EU]: { requests: 0, recordsExported: 0 },
      [Region.AU]: { requests: 0, recordsExported: 0 },
    },
    averageRecords: 0,
  };

  const uniqueExports = new Set(dsarAuditLogs.map(log => log.exportId));
  metrics.totalRequests = uniqueExports.size;

  let totalRecords = 0;

  for (const log of dsarAuditLogs) {
    if (log.success) {
      metrics.successfulRequests++;
      totalRecords += log.recordCount;

      metrics.byRegion[log.region].requests++;
      metrics.byRegion[log.region].recordsExported += log.recordCount;
    } else {
      metrics.failedRequests++;
    }
  }

  metrics.averageRecords = dsarAuditLogs.length > 0 ? totalRecords / dsarAuditLogs.length : 0;

  return metrics;
}

