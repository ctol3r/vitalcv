/**
 * Support & Incident Audit Export API
 *
 * Provides audit-compliant exports of support tickets and incident logs
 * for external auditors. Excludes PHI/PII and creates anchored manifests
 * for tamper detection.
 *
 * Endpoints:
 * - POST /api/org/:orgId/support/audit-export - Create export request
 * - GET /api/org/:orgId/support/audit-export/:exportId - Get export status
 * - GET /api/org/:orgId/support/audit-export/:exportId/download - Download export
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schemas
const CreateExportSchema = z.object({
  orgId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  includeTickets: z.boolean().default(true),
  includeIncidents: z.boolean().default(true),
  format: z.enum(['json', 'csv', 'both']).default('both'),
  requestedBy: z.string().uuid()
});

// Types
interface AuditExportRequest {
  id: string;
  orgId: string;
  startDate: Date;
  endDate: Date;
  includeTickets: boolean;
  includeIncidents: boolean;
  format: 'json' | 'csv' | 'both';
  requestedBy: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  createdAt: Date;
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  manifestHash?: string;
  recordCount?: {
    tickets: number;
    incidents: number;
    statusChanges: number;
  };
}

interface SupportTicketAuditRecord {
  ticketId: string;
  orgId: string;
  // userId intentionally excluded or anonymized
  category: string;
  severity: string;
  status: string;
  title: string;
  // description excluded to prevent PHI leak
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  slaBreached: boolean;
  firstResponseTimeMinutes?: number;
  resolutionTimeMinutes?: number;
}

interface IncidentAuditRecord {
  incidentId: string;
  relatedTicketId?: string;
  severity: string;
  status: string;
  title: string;
  // description excluded
  detectedAt: string;
  declaredAt: string;
  resolvedAt?: string;
  durationMinutes?: number;
  customersAffected?: number;
  usersAffected?: number;
  incidentCommander?: string; // anonymized
  rootCauseSummary?: string; // sanitized
}

interface ExportManifest {
  exportId: string;
  orgId: string;
  generatedAt: string;
  requestedBy: string; // anonymized
  dateRange: {
    start: string;
    end: string;
  };
  recordCounts: {
    supportTickets: number;
    incidents: number;
    statusChanges: number;
  };
  files: {
    name: string;
    format: string;
    recordCount: number;
    sha256: string;
  }[];
  manifestHash: string;
  signature?: string; // Optional cryptographic signature
}

/**
 * POST /api/org/:orgId/support/audit-export
 * Create a new audit export request
 */
router.post('/:orgId/support/audit-export', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const validatedData = CreateExportSchema.parse({ ...req.body, orgId });

    // Validate date range
    const startDate = new Date(validatedData.startDate);
    const endDate = new Date(validatedData.endDate);

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be before end date'
      });
    }

    // Limit export range to prevent abuse
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 365) {
      return res.status(400).json({
        success: false,
        error: 'Export range cannot exceed 365 days'
      });
    }

    const exportRequest: AuditExportRequest = {
      id: uuidv4(),
      orgId: validatedData.orgId,
      startDate,
      endDate,
      includeTickets: validatedData.includeTickets,
      includeIncidents: validatedData.includeIncidents,
      format: validatedData.format,
      requestedBy: validatedData.requestedBy,
      status: 'PENDING',
      createdAt: new Date()
    };

    // TODO: Save export request to database
    // await db.query('INSERT INTO audit_export_requests ...', exportRequest);

    // Queue export job for async processing
    await queueExportJob(exportRequest);

    // Log audit event
    await logAuditEvent({
      eventType: 'audit_export.requested',
      actorId: validatedData.requestedBy,
      orgId: validatedData.orgId,
      resourceType: 'audit_export',
      resourceId: exportRequest.id,
      metadata: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        includeTickets: validatedData.includeTickets,
        includeIncidents: validatedData.includeIncidents
      },
      timestamp: new Date()
    });

    res.status(202).json({
      success: true,
      data: {
        exportId: exportRequest.id,
        status: exportRequest.status,
        estimatedCompletionMinutes: 5
      },
      message: 'Export request queued for processing'
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors
      });
    }

    console.error('Error creating audit export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create audit export'
    });
  }
});

/**
 * GET /api/org/:orgId/support/audit-export/:exportId
 * Get export status
 */
router.get('/:orgId/support/audit-export/:exportId', async (req: Request, res: Response) => {
  try {
    const { orgId, exportId } = req.params;

    // TODO: Fetch from database
    // const exportRequest = await db.query('SELECT * FROM audit_export_requests WHERE id = $1 AND org_id = $2', [exportId, orgId]);

    // Mock response
    const exportRequest: AuditExportRequest = {
      id: exportId,
      orgId,
      startDate: new Date('2025-01-01'),
      endDate: new Date('2025-11-13'),
      includeTickets: true,
      includeIncidents: true,
      format: 'both',
      requestedBy: 'user-123',
      status: 'COMPLETED',
      createdAt: new Date(),
      completedAt: new Date(),
      downloadUrl: `/api/org/${orgId}/support/audit-export/${exportId}/download`,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      manifestHash: 'abc123...',
      recordCount: {
        tickets: 45,
        incidents: 3,
        statusChanges: 128
      }
    };

    res.json({
      success: true,
      data: exportRequest
    });
  } catch (error) {
    console.error('Error fetching audit export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit export'
    });
  }
});

/**
 * GET /api/org/:orgId/support/audit-export/:exportId/download
 * Download completed export
 */
router.get('/:orgId/support/audit-export/:exportId/download', async (req: Request, res: Response) => {
  try {
    const { orgId, exportId } = req.params;

    // TODO: Fetch export request and verify status
    // const exportRequest = await db.query('SELECT * FROM audit_export_requests WHERE id = $1 AND org_id = $2', [exportId, orgId]);

    // Verify export is completed
    // if (exportRequest.status !== 'COMPLETED') {
    //   return res.status(400).json({ success: false, error: 'Export not ready' });
    // }

    // Check if export has expired
    // if (new Date() > exportRequest.expiresAt) {
    //   return res.status(410).json({ success: false, error: 'Export has expired' });
    // }

    // TODO: Stream file from storage
    // const fileStream = await getExportFile(exportId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${exportId}.zip"`);

    // Mock: Send explanation instead of actual file
    res.send('Export file would be streamed here');
  } catch (error) {
    console.error('Error downloading audit export:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download audit export'
    });
  }
});

// Helper functions

/**
 * Queue export job for background processing
 */
async function queueExportJob(request: AuditExportRequest): Promise<void> {
  // TODO: Integrate with job queue (Bull, BullMQ, or SQS)
  console.log('[AUDIT_EXPORT] Queued export job:', request.id);

  // Simulate async processing
  setTimeout(async () => {
    await processExport(request);
  }, 1000);
}

/**
 * Process export request (runs in background worker)
 */
async function processExport(request: AuditExportRequest): Promise<void> {
  try {
    console.log('[AUDIT_EXPORT] Processing export:', request.id);

    // Update status to PROCESSING
    // await db.query('UPDATE audit_export_requests SET status = $1 WHERE id = $2', ['PROCESSING', request.id]);

    // Fetch data
    const tickets = await fetchSupportTicketsForExport(request);
    const incidents = await fetchIncidentsForExport(request);

    // Generate files
    const files: { name: string; content: string; format: string; recordCount: number }[] = [];

    if (request.format === 'json' || request.format === 'both') {
      files.push({
        name: 'support-tickets.json',
        content: JSON.stringify(tickets, null, 2),
        format: 'json',
        recordCount: tickets.length
      });
      files.push({
        name: 'incidents.json',
        content: JSON.stringify(incidents, null, 2),
        format: 'json',
        recordCount: incidents.length
      });
    }

    if (request.format === 'csv' || request.format === 'both') {
      files.push({
        name: 'support-tickets.csv',
        content: convertToCSV(tickets),
        format: 'csv',
        recordCount: tickets.length
      });
      files.push({
        name: 'incidents.csv',
        content: convertToCSV(incidents),
        format: 'csv',
        recordCount: incidents.length
      });
    }

    // Generate manifest
    const manifest = generateManifest(request, files, tickets, incidents);
    files.push({
      name: 'manifest.json',
      content: JSON.stringify(manifest, null, 2),
      format: 'json',
      recordCount: 1
    });

    // TODO: Create ZIP file and upload to secure storage
    // const zipBuffer = await createZip(files);
    // const downloadUrl = await uploadToStorage(request.id, zipBuffer);

    // Update export request
    // await db.query(`
    //   UPDATE audit_export_requests
    //   SET status = $1, completed_at = $2, download_url = $3, expires_at = $4, manifest_hash = $5
    //   WHERE id = $6
    // `, ['COMPLETED', new Date(), downloadUrl, expiresAt, manifest.manifestHash, request.id]);

    console.log('[AUDIT_EXPORT] Export completed:', request.id);
  } catch (error) {
    console.error('[AUDIT_EXPORT] Export failed:', request.id, error);
    // await db.query('UPDATE audit_export_requests SET status = $1 WHERE id = $2', ['FAILED', request.id]);
  }
}

/**
 * Fetch support tickets for export (sanitized)
 */
async function fetchSupportTicketsForExport(request: AuditExportRequest): Promise<SupportTicketAuditRecord[]> {
  // TODO: Fetch from database with PHI/PII exclusions
  // const tickets = await db.query(`
  //   SELECT
  //     id as ticket_id,
  //     org_id,
  //     category,
  //     severity,
  //     status,
  //     title,
  //     created_at,
  //     updated_at,
  //     resolved_at,
  //     closed_at,
  //     CASE WHEN first_response_at > sla_deadline THEN true ELSE false END as sla_breached,
  //     EXTRACT(EPOCH FROM (first_response_at - created_at))/60 as first_response_time_minutes,
  //     EXTRACT(EPOCH FROM (resolved_at - created_at))/60 as resolution_time_minutes
  //   FROM support_tickets
  //   WHERE org_id = $1
  //     AND created_at BETWEEN $2 AND $3
  //   ORDER BY created_at DESC
  // `, [request.orgId, request.startDate, request.endDate]);

  // Mock data
  return [];
}

/**
 * Fetch incidents for export (sanitized)
 */
async function fetchIncidentsForExport(request: AuditExportRequest): Promise<IncidentAuditRecord[]> {
  // TODO: Fetch from database
  return [];
}

/**
 * Convert records to CSV format
 */
function convertToCSV(records: any[]): string {
  if (records.length === 0) return '';

  const headers = Object.keys(records[0]);
  const rows = records.map(record =>
    headers.map(header => {
      const value = record[header];
      // Escape quotes and wrap in quotes if contains comma
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value ?? '';
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Generate export manifest with integrity hashes
 */
function generateManifest(
  request: AuditExportRequest,
  files: { name: string; content: string; format: string; recordCount: number }[],
  tickets: any[],
  incidents: any[]
): ExportManifest {
  const filesWithHashes = files
    .filter(f => f.name !== 'manifest.json')
    .map(file => ({
      name: file.name,
      format: file.format,
      recordCount: file.recordCount,
      sha256: createHash('sha256').update(file.content).digest('hex')
    }));

  const manifest: ExportManifest = {
    exportId: request.id,
    orgId: request.orgId,
    generatedAt: new Date().toISOString(),
    requestedBy: anonymizeUserId(request.requestedBy),
    dateRange: {
      start: request.startDate.toISOString(),
      end: request.endDate.toISOString()
    },
    recordCounts: {
      supportTickets: tickets.length,
      incidents: incidents.length,
      statusChanges: 0 // TODO: Calculate actual count
    },
    files: filesWithHashes,
    manifestHash: '' // Will be calculated below
  };

  // Calculate manifest hash (excluding the hash field itself)
  const manifestContent = JSON.stringify({
    ...manifest,
    manifestHash: undefined
  });
  manifest.manifestHash = createHash('sha256').update(manifestContent).digest('hex');

  return manifest;
}

/**
 * Anonymize user ID for audit trail
 */
function anonymizeUserId(userId: string): string {
  // Use consistent hash for anonymization
  return 'user-' + createHash('sha256').update(userId).digest('hex').substring(0, 8);
}

/**
 * Log audit event
 */
async function logAuditEvent(event: {
  eventType: string;
  actorId: string;
  orgId: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any>;
  timestamp: Date;
}): Promise<void> {
  // TODO: Integrate with audit logging service
  console.log('[AUDIT]', event);
}

export default router;

