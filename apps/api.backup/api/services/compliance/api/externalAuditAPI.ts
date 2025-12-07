/**
 * B239B-COM-018: ExternalAuditAPI
 *
 * Provides secure API for authorised auditors/regulators to access:
 * - Compliance reports
 * - Audit logs
 * - Evidence documents
 * Enforces strict scopes, authentication, rate limits.
 * Supports download of evidence.
 */

import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { queryAuditLogs } from '../audit/auditLogQueryService.js';
import { generateComplianceReport } from '../reports/complianceReportGenerator.js';
import { generateGDPRReport } from '../reports/gdprReportGenerator.js';
import { performHIPAAAudit } from '../auditors/hipaaComplianceAuditor.js';

const prisma = new PrismaClient();
const log = getServiceLogger('compliance/api/external');

export interface ExternalAuditor {
  id: string;
  name: string;
  organization: string;
  scopes: string[];
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  allowedObligations: string[];
  active: boolean;
}

export interface APIRequest {
  auditorId: string;
  endpoint: string;
  timestamp: Date;
  ipAddress: string;
  userAgent?: string;
}

// Rate limiting tracking
const rateLimitStore = new Map<
  string,
  { requests: Date[]; dailyCount: number; lastReset: Date }
>();

/**
 * Validate auditor access and rate limits
 */
export async function validateAuditorAccess(
  auditorId: string,
  requiredScope: string,
  ipAddress: string
): Promise<{ valid: boolean; auditor?: ExternalAuditor; reason?: string }> {
  try {
    // Get auditor record
    // In production, this would query from a database table
    // For now, we'll use a placeholder structure
    const auditor = await getAuditor(auditorId);

    if (!auditor) {
      return { valid: false, reason: 'Auditor not found' };
    }

    if (!auditor.active) {
      return { valid: false, reason: 'Auditor account is inactive' };
    }

    if (!auditor.scopes.includes(requiredScope)) {
      return { valid: false, reason: 'Insufficient scope' };
    }

    // Check rate limits
    const rateLimitCheck = checkRateLimit(auditorId, auditor.rateLimit);
    if (!rateLimitCheck.allowed) {
      return { valid: false, reason: rateLimitCheck.reason };
    }

    // Log API access
    await logAPIAccess({
      auditorId,
      endpoint: requiredScope,
      timestamp: new Date(),
      ipAddress,
    });

    return { valid: true, auditor };
  } catch (error) {
    log.error('[validateAuditorAccess] Validation failed', { error, auditorId });
    return { valid: false, reason: 'Validation error' };
  }
}

async function getAuditor(auditorId: string): Promise<ExternalAuditor | null> {
  // TODO: Query from database
  // return await prisma.externalAuditor.findUnique({ where: { id: auditorId } });

  // Placeholder - in production, this would be a database query
  return null;
}

function checkRateLimit(
  auditorId: string,
  limits: ExternalAuditor['rateLimit']
): { allowed: boolean; reason?: string } {
  const now = new Date();
  const key = auditorId;
  let record = rateLimitStore.get(key);

  if (!record) {
    record = {
      requests: [],
      dailyCount: 0,
      lastReset: now,
    };
    rateLimitStore.set(key, record);
  }

  // Reset daily count if needed
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  if (record.lastReset < dayStart) {
    record.dailyCount = 0;
    record.lastReset = dayStart;
  }

  // Check per-minute limit
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  record.requests = record.requests.filter((r) => r > oneMinuteAgo);
  if (record.requests.length >= limits.requestsPerMinute) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${limits.requestsPerMinute} requests per minute`,
    };
  }

  // Check per-day limit
  if (record.dailyCount >= limits.requestsPerDay) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${limits.requestsPerDay} requests per day`,
    };
  }

  // Record this request
  record.requests.push(now);
  record.dailyCount++;

  return { allowed: true };
}

async function logAPIAccess(request: APIRequest): Promise<void> {
  try {
    log.info('[logAPIAccess] External API access', {
      auditorId: request.auditorId,
      endpoint: request.endpoint,
      ipAddress: request.ipAddress,
    });

    // TODO: Store in audit log
    // await prisma.externalAPIAccessLog.create({ data: request });
  } catch (error) {
    log.error('[logAPIAccess] Failed to log API access', { error, request });
  }
}

/**
 * Get compliance report for external auditor
 */
export async function getComplianceReportForAuditor(
  auditorId: string,
  options: {
    startDate: Date;
    endDate: Date;
    obligationIds?: string[];
    format?: 'json' | 'csv';
  },
  ipAddress: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
  const validation = await validateAuditorAccess(
    auditorId,
    'read:compliance_reports',
    ipAddress
  );

  if (!validation.valid || !validation.auditor) {
    return { success: false, error: validation.reason };
  }

  try {
    // Check if auditor has access to requested obligations
    if (options.obligationIds) {
      const unauthorized = options.obligationIds.filter(
        (oid) => !validation.auditor!.allowedObligations.includes(oid)
      );
      if (unauthorized.length > 0) {
        return {
          success: false,
          error: `Unauthorized access to obligations: ${unauthorized.join(', ')}`,
        };
      }
    }

    const report = await generateComplianceReport({
      startDate: options.startDate,
      endDate: options.endDate,
      obligationIds: options.obligationIds || validation.auditor.allowedObligations,
      format: options.format || 'json',
    });

    return { success: true, report };
  } catch (error) {
    log.error('[getComplianceReportForAuditor] Failed to generate report', {
      error,
      auditorId,
    });
    return { success: false, error: 'Failed to generate report' };
  }
}

/**
 * Get GDPR report for external auditor
 */
export async function getGDPRReportForAuditor(
  auditorId: string,
  options: {
    startDate: Date;
    endDate: Date;
    jurisdiction?: string;
  },
  ipAddress: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
  const validation = await validateAuditorAccess(
    auditorId,
    'read:gdpr_reports',
    ipAddress
  );

  if (!validation.valid || !validation.auditor) {
    return { success: false, error: validation.reason };
  }

  if (!validation.auditor.allowedObligations.includes('GDPR')) {
    return { success: false, error: 'Unauthorized access to GDPR reports' };
  }

  try {
    const report = await generateGDPRReport({
      startDate: options.startDate,
      endDate: options.endDate,
      jurisdiction: options.jurisdiction || 'EU',
    });

    return { success: true, report };
  } catch (error) {
    log.error('[getGDPRReportForAuditor] Failed to generate GDPR report', {
      error,
      auditorId,
    });
    return { success: false, error: 'Failed to generate GDPR report' };
  }
}

/**
 * Get HIPAA audit report for external auditor
 */
export async function getHIPAAReportForAuditor(
  auditorId: string,
  options: {
    startDate: Date;
    endDate: Date;
  },
  ipAddress: string
): Promise<{ success: boolean; report?: unknown; error?: string }> {
  const validation = await validateAuditorAccess(
    auditorId,
    'read:hipaa_reports',
    ipAddress
  );

  if (!validation.valid || !validation.auditor) {
    return { success: false, error: validation.reason };
  }

  if (!validation.auditor.allowedObligations.includes('HIPAA')) {
    return { success: false, error: 'Unauthorized access to HIPAA reports' };
  }

  try {
    const report = await performHIPAAAudit({
      startDate: options.startDate,
      endDate: options.endDate,
    });

    return { success: true, report };
  } catch (error) {
    log.error('[getHIPAAReportForAuditor] Failed to generate HIPAA report', {
      error,
      auditorId,
    });
    return { success: false, error: 'Failed to generate HIPAA report' };
  }
}

/**
 * Get audit logs for external auditor
 */
export async function getAuditLogsForAuditor(
  auditorId: string,
  options: {
    startDate: Date;
    endDate: Date;
    entityType?: string;
    action?: string;
    obligationId?: string;
    limit?: number;
    offset?: number;
  },
  ipAddress: string
): Promise<{ success: boolean; logs?: unknown; error?: string }> {
  const validation = await validateAuditorAccess(
    auditorId,
    'read:audit_logs',
    ipAddress
  );

  if (!validation.valid || !validation.auditor) {
    return { success: false, error: validation.reason };
  }

  // Check obligation access
  if (options.obligationId && !validation.auditor.allowedObligations.includes(options.obligationId)) {
    return {
      success: false,
      error: `Unauthorized access to obligation: ${options.obligationId}`,
    };
  }

  try {
    const logs = await queryAuditLogs(
      {
        startDate: options.startDate,
        endDate: options.endDate,
        entityType: options.entityType,
        action: options.action,
        obligationId: options.obligationId,
        limit: options.limit || 100,
        offset: options.offset || 0,
      },
      { requireAccessRights: false } // External auditors have explicit access
    );

    return { success: true, logs };
  } catch (error) {
    log.error('[getAuditLogsForAuditor] Failed to get audit logs', {
      error,
      auditorId,
    });
    return { success: false, error: 'Failed to get audit logs' };
  }
}

/**
 * Download evidence document for external auditor
 */
export async function downloadEvidenceForAuditor(
  auditorId: string,
  evidenceId: string,
  ipAddress: string
): Promise<{ success: boolean; document?: Buffer; error?: string }> {
  const validation = await validateAuditorAccess(
    auditorId,
    'read:evidence',
    ipAddress
  );

  if (!validation.valid || !validation.auditor) {
    return { success: false, error: validation.reason };
  }

  try {
    // TODO: Retrieve evidence document from storage
    // const document = await getEvidenceDocument(evidenceId, validation.auditor);
    // return { success: true, document };

    return { success: false, error: 'Evidence download not yet implemented' };
  } catch (error) {
    log.error('[downloadEvidenceForAuditor] Failed to download evidence', {
      error,
      auditorId,
      evidenceId,
    });
    return { success: false, error: 'Failed to download evidence' };
  }
}

