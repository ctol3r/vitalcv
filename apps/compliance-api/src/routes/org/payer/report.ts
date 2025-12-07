/**
 * B137C-REPORT-001: Payer Enrollment Status Report
 *
 * Returns counts by status per payer for an organization
 * Supports JSON and CSV export formats
 * Supports date range filtering
 *
 * Acceptance Criteria:
 * - Returns counts by status per payer
 * - Supports JSON and CSV formats
 * - Filter by date range
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { EnrollmentStatus, ENROLLMENT_STATUS_SEQUENCE } from '@domain-common/payer/enrollment';


const router = Router();
const prisma = new PrismaClient();

interface PayerStatusCount {
  payerId: string;
  payerName: string;
  DRAFT: number;
  SUBMITTED: number;
  APPROVED: number;
  DENIED: number;
  TERMINATED: number;
  total: number;
}

interface PayerEnrollmentReport {
  orgId: string;
  generatedAt: string;
  dateRange?: {
    from: string;
    to: string;
  };
  summary: {
    totalEnrollments: number;
    byStatus: Record<EnrollmentStatus, number>;
  };
  byPayer: PayerStatusCount[];
}

/**
 * Convert report to CSV format
 */
function convertToCSV(report: PayerEnrollmentReport): string {
  const headers = [
    'Payer ID',
    'Payer Name',
    'DRAFT',
    'SUBMITTED',
    'APPROVED',
    'DENIED',
    'TERMINATED',
    'Total'
  ].join(',');

  const rows = report.byPayer.map(payer => {
    return [
      payer.payerId,
      `"${payer.payerName}"`, // Quote payer name in case it contains commas
      payer.DRAFT,
      payer.SUBMITTED,
      payer.APPROVED,
      payer.DENIED,
      payer.TERMINATED,
      payer.total
    ].join(',');
  });

  // Add summary row
  const summary = [
    'TOTAL',
    '',
    report.summary.byStatus.DRAFT || 0,
    report.summary.byStatus.SUBMITTED || 0,
    report.summary.byStatus.APPROVED || 0,
    report.summary.byStatus.DENIED || 0,
    report.summary.byStatus.TERMINATED || 0,
    report.summary.totalEnrollments
  ].join(',');

  return [headers, ...rows, '', summary].join('\n');
}

/**
 * GET /org/:orgId/payer/report
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - from: ISO date string for date range start (optional)
 * - to: ISO date string for date range end (optional)
 * - status: Filter by specific status (optional)
 * - payerId: Filter by specific payer (optional)
 *
 * Returns payer enrollment status counts grouped by payer
 */
router.get('/org/:orgId/payer/report', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { format = 'json', from, to, status, payerId } = req.query;

    // Build date range filter
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) {
        dateFilter.createdAt.gte = new Date(from as string);
      }
      if (to) {
        dateFilter.createdAt.lte = new Date(to as string);
      }
    }

    // Build query filters
    const whereClause: any = {
      orgId,
      ...dateFilter
    };

    if (status) {
      whereClause.status = (status as string).toUpperCase();
    }

    if (payerId) {
      whereClause.payerId = payerId as string;
    }

    // Fetch all payer enrollments for the organization
    const enrollments = await prisma.payerEnrollment.findMany({
      where: whereClause,
      include: {
        payer: {
          select: {
            id: true,
            name: true,
            payerId: true
          }
        }
      }
    });

    if (enrollments.length === 0) {
      return res.status(404).json({
        error: 'no_enrollments_found',
        error_description: `No payer enrollments found for organization ${orgId}`
      });
    }

    // Group enrollments by payer and count by status
    const payerMap = new Map<string, {
      payerId: string;
      payerName: string;
      counts: Record<EnrollmentStatus, number>;
    }>();

    const statuses: EnrollmentStatus[] = [...ENROLLMENT_STATUS_SEQUENCE];

    // Initialize payer map
    for (const enrollment of enrollments) {
      const payerId = enrollment.payer.payerId;
      if (!payerMap.has(payerId)) {
        const counts: Record<EnrollmentStatus, number> = {
          DRAFT: 0,
          SUBMITTED: 0,
          APPROVED: 0,
          DENIED: 0,
          TERMINATED: 0
        };
        payerMap.set(payerId, {
          payerId,
          payerName: enrollment.payer.name,
          counts
        });
      }

      // Increment status count
      const payerData = payerMap.get(payerId)!;
      const enrollmentStatus = enrollment.status as EnrollmentStatus;
      if (statuses.includes(enrollmentStatus)) {
        payerData.counts[enrollmentStatus]++;
      }
    }

    // Calculate summary totals
    const summaryByStatus: Record<EnrollmentStatus, number> = {
      DRAFT: 0,
      SUBMITTED: 0,
      APPROVED: 0,
      DENIED: 0,
      TERMINATED: 0
    };

    const byPayer: PayerStatusCount[] = [];

    for (const [_, payerData] of payerMap.entries()) {
      const total = Object.values(payerData.counts).reduce((sum, count) => sum + count, 0);

      byPayer.push({
        payerId: payerData.payerId,
        payerName: payerData.payerName,
        DRAFT: payerData.counts.DRAFT,
        SUBMITTED: payerData.counts.SUBMITTED,
        APPROVED: payerData.counts.APPROVED,
        DENIED: payerData.counts.DENIED,
        TERMINATED: payerData.counts.TERMINATED,
        total
      });

      // Add to summary
      for (const status of statuses) {
        summaryByStatus[status] += payerData.counts[status];
      }
    }

    // Sort by payer name
    byPayer.sort((a, b) => a.payerName.localeCompare(b.payerName));

    const report: PayerEnrollmentReport = {
      orgId,
      generatedAt: new Date().toISOString(),
      ...(from || to ? {
        dateRange: {
          from: from ? new Date(from as string).toISOString() : '',
          to: to ? new Date(to as string).toISOString() : ''
        }
      } : {}),
      summary: {
        totalEnrollments: enrollments.length,
        byStatus: summaryByStatus
      },
      byPayer
    };

    // Return CSV format if requested
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payer-enrollment-report-${orgId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Return JSON by default
    res.json(report);
  } catch (error) {
    console.error('Error generating payer enrollment report:', error);
    res.status(500).json({
      error: 'report_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

