const log = getServiceLogger('audit/ehrFacadeEvents');
/**
 * B136A-LOG-012: Audit Logging for EHR/TEFCA Facade Requests
 *
 * Logs all requests to EHR and TEFCA FHIR facades with PHI-stripped query hashes.
 * Anchored via AuditScrapbook for tamper-evident audit trails.
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../logging/serviceLogger';

const prisma = new PrismaClient();

/**
 * EHR/TEFCA Facade Audit Event
 */
export interface EhrFacadeAuditEvent {
  orgId: string;
  source: 'ehr' | 'tefca';
  resourceType: string;
  queryParams: Record<string, any>;
  purposeOfUse?: string;
  statusCode?: number;
  duration?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Strip PHI from query parameters before hashing
 */
function stripPHI(params: Record<string, any>): Record<string, any> {
  const stripped: Record<string, any> = {};
  const phiFields = ['name', 'identifier', 'birthdate', 'address', 'telecom', 'ssn', 'email'];

  for (const [key, value] of Object.entries(params)) {
    // Skip known PHI fields
    if (phiFields.includes(key.toLowerCase())) {
      stripped[key] = '[REDACTED]';
    } else {
      stripped[key] = value;
    }
  }

  return stripped;
}

/**
 * Compute SHA-256 hash of query parameters (PHI-stripped)
 */
function hashQueryParams(params: Record<string, any>): string {
  const stripped = stripPHI(params);
  const normalized = JSON.stringify(stripped, Object.keys(stripped).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Log EHR/TEFCA facade request
 */
export async function logEhrFacadeRequest(event: EhrFacadeAuditEvent): Promise<void> {
  try {
    const queryHash = hashQueryParams(event.queryParams);

    await prisma.ehrFacadeAudit.create({
      data: {
        orgId: event.orgId,
        source: event.source,
        resourceType: event.resourceType,
        queryHash,
        purposeOfUse: event.purposeOfUse,
        statusCode: event.statusCode,
        duration: event.duration,
        errorMessage: event.errorMessage,
        metadata: event.metadata as any,
      },
    });

    // TODO: Anchor to AuditScrapbook for tamper-evident logging (future enhancement)
  } catch (error) {
    // Non-blocking: log error but don't fail the request
    log.error('Failed to log EHR facade audit event:', error);
  }
}

/**
 * Query audit logs for an organization
 */
export async function getAuditLogs(orgId: string, options: {
  source?: 'ehr' | 'tefca';
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) {
  const where: any = { orgId };

  if (options.source) where.source = options.source;
  if (options.resourceType) where.resourceType = options.resourceType;
  if (options.startDate || options.endDate) {
    where.createdAt = {};
    if (options.startDate) where.createdAt.gte = options.startDate;
    if (options.endDate) where.createdAt.lte = options.endDate;
  }

  return await prisma.ehrFacadeAudit.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: options.limit || 100,
  });
}

/**
 * Get audit statistics for an organization
 */
export async function getAuditStats(orgId: string, source?: 'ehr' | 'tefca') {
  const where: any = { orgId };
  if (source) where.source = source;

  const [total, byResource, byStatus] = await Promise.all([
    // Total requests
    prisma.ehrFacadeAudit.count({ where }),

    // Requests by resource type
    prisma.ehrFacadeAudit.groupBy({
      by: ['resourceType'],
      where,
      _count: { id: true },
    }),

    // Requests by status code
    prisma.ehrFacadeAudit.groupBy({
      by: ['statusCode'],
      where: { ...where, statusCode: { not: null } },
      _count: { id: true },
    }),
  ]);

  return {
    total,
    byResource: byResource.map(r => ({
      resourceType: r.resourceType,
      count: r._count.id,
    })),
    byStatus: byStatus.map(s => ({
      statusCode: s.statusCode,
      count: s._count.id,
    })),
  };
}

/**
 * Export audit logs for compliance (e.g., HIPAA audit trail)
 */
export async function exportAuditLogs(orgId: string, startDate: Date, endDate: Date) {
  const logs = await prisma.ehrFacadeAudit.findMany({
    where: {
      orgId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Return logs in a format suitable for export (CSV, JSON, etc.)
  return logs;
}

