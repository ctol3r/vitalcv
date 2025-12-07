/**
 * B135C-REPORT-002: FPPE/OPPE Compliance Report
 *
 * Summarizes FPPE/OPPE tasks per clinician with due/complete/overdue status
 * Supports JSON and CSV export formats
 *
 * Acceptance Criteria:
 * - Summarizes FPPE/OPPE tasks per clinician
 * - JSON and CSV export
 * - Tests with seed data
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface ClinicianFppeOppeStatus {
  clinicianDid: string;
  clinicianNpi?: string;
  clinicianName?: string;
  fppe: {
    status: string;
    startDate?: string;
    endDate?: string;
    daysRemaining?: number;
    isOverdue: boolean;
    completedOn?: string;
  };
  oppe: {
    status: string;
    nextReviewDue?: string;
    lastReviewDate?: string;
    daysUntilDue?: number;
    isOverdue: boolean;
    intervalMonths: number;
  };
  overallStatus: 'COMPLIANT' | 'DUE_SOON' | 'OVERDUE' | 'NOT_STARTED';
}

interface FppeOppeComplianceReport {
  orgId: string;
  generatedAt: string;
  summary: {
    totalClinicians: number;
    compliant: number;
    dueSoon: number; // Within 30 days
    overdue: number;
    notStarted: number;
    fppeStats: {
      notStarted: number;
      inProgress: number;
      completed: number;
      failed: number;
    };
    oppeStats: {
      notStarted: number;
      active: number;
      hold: number;
      overdue: number;
    };
  };
  clinicians: ClinicianFppeOppeStatus[];
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Determine overall compliance status for a clinician
 */
function determineOverallStatus(clinician: ClinicianFppeOppeStatus): ClinicianFppeOppeStatus['overallStatus'] {
  if (clinician.fppe.isOverdue || clinician.oppe.isOverdue) {
    return 'OVERDUE';
  }

  if (
    (clinician.fppe.daysRemaining !== undefined && clinician.fppe.daysRemaining <= 30) ||
    (clinician.oppe.daysUntilDue !== undefined && clinician.oppe.daysUntilDue <= 30)
  ) {
    return 'DUE_SOON';
  }

  if (
    clinician.fppe.status === 'COMPLETED' &&
    clinician.oppe.status === 'ACTIVE' &&
    !clinician.oppe.isOverdue
  ) {
    return 'COMPLIANT';
  }

  if (
    clinician.fppe.status === 'NOT_STARTED' ||
    clinician.oppe.status === 'NOT_STARTED'
  ) {
    return 'NOT_STARTED';
  }

  return 'COMPLIANT';
}

/**
 * Convert report to CSV format
 */
function convertToCSV(report: FppeOppeComplianceReport): string {
  const headers = [
    'Clinician DID',
    'Clinician NPI',
    'FPPE Status',
    'FPPE Start Date',
    'FPPE End Date',
    'FPPE Days Remaining',
    'FPPE Overdue',
    'OPPE Status',
    'OPPE Next Review Due',
    'OPPE Last Review',
    'OPPE Days Until Due',
    'OPPE Overdue',
    'Overall Status'
  ].join(',');

  const rows = report.clinicians.map(c => {
    return [
      c.clinicianDid,
      c.clinicianNpi || '',
      c.fppe.status,
      c.fppe.startDate || '',
      c.fppe.endDate || '',
      c.fppe.daysRemaining !== undefined ? c.fppe.daysRemaining : '',
      c.fppe.isOverdue ? 'YES' : 'NO',
      c.oppe.status,
      c.oppe.nextReviewDue || '',
      c.oppe.lastReviewDate || '',
      c.oppe.daysUntilDue !== undefined ? c.oppe.daysUntilDue : '',
      c.oppe.isOverdue ? 'YES' : 'NO',
      c.overallStatus
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * GET /org/:orgId/oppe/report
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - status: Filter by overall status (COMPLIANT, DUE_SOON, OVERDUE, NOT_STARTED)
 * - overdue: 'true' to show only overdue items
 *
 * Returns FPPE/OPPE compliance status for all clinicians in the organization
 */
router.get('/org/:orgId/oppe/report', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { format = 'json', status, overdue } = req.query;

    // Fetch all FPPE/OPPE records for the organization
    const fppeOppeRecords = await prisma.fppeOppe.findMany({
      where: {
        orgId
      },
      include: {
        privilegeRequest: {
          select: {
            clinicianDid: true
          }
        }
      }
    });

    if (fppeOppeRecords.length === 0) {
      return res.status(404).json({
        error: 'no_records_found',
        error_description: `No FPPE/OPPE records found for organization ${orgId}`
      });
    }

    const now = new Date();
    const clinicians: ClinicianFppeOppeStatus[] = [];

    // Initialize summary statistics
    const summary = {
      totalClinicians: fppeOppeRecords.length,
      compliant: 0,
      dueSoon: 0,
      overdue: 0,
      notStarted: 0,
      fppeStats: {
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        failed: 0
      },
      oppeStats: {
        notStarted: 0,
        active: 0,
        hold: 0,
        overdue: 0
      }
    };

    for (const record of fppeOppeRecords) {
      // Calculate FPPE status
      const fppeStatus = {
        status: record.fppeStatus,
        startDate: record.fppeStartDate?.toISOString(),
        endDate: record.fppeEndDate?.toISOString(),
        daysRemaining: undefined as number | undefined,
        isOverdue: false,
        completedOn: record.fppeStatus === 'COMPLETED' ? record.updatedAt.toISOString() : undefined
      };

      if (record.fppeEndDate) {
        fppeStatus.daysRemaining = daysBetween(now, record.fppeEndDate);
        fppeStatus.isOverdue = fppeStatus.daysRemaining < 0;
      }

      // Update FPPE stats
      if (record.fppeStatus === 'NOT_STARTED') summary.fppeStats.notStarted++;
      else if (record.fppeStatus === 'IN_PROGRESS') summary.fppeStats.inProgress++;
      else if (record.fppeStatus === 'COMPLETED') summary.fppeStats.completed++;
      else if (record.fppeStatus === 'FAILED') summary.fppeStats.failed++;

      // Calculate OPPE status
      const oppeStatus = {
        status: record.oppeStatus,
        nextReviewDue: record.oppeNextReviewDue?.toISOString(),
        lastReviewDate: record.oppeLastReviewDate?.toISOString(),
        daysUntilDue: undefined as number | undefined,
        isOverdue: false,
        intervalMonths: record.oppeIntervalMonths
      };

      if (record.oppeNextReviewDue) {
        oppeStatus.daysUntilDue = daysBetween(now, record.oppeNextReviewDue);
        oppeStatus.isOverdue = oppeStatus.daysUntilDue < 0;
      }

      // Update OPPE stats
      if (record.oppeStatus === 'NOT_STARTED') summary.oppeStats.notStarted++;
      else if (record.oppeStatus === 'ACTIVE') {
        if (oppeStatus.isOverdue) summary.oppeStats.overdue++;
        else summary.oppeStats.active++;
      } else if (record.oppeStatus === 'HOLD') summary.oppeStats.hold++;

      const clinician: ClinicianFppeOppeStatus = {
        clinicianDid: record.clinicianDid,
        clinicianNpi: undefined, // Could be fetched from User/NpiClaim
        fppe: fppeStatus,
        oppe: oppeStatus,
        overallStatus: 'NOT_STARTED' // Will be calculated below
      };

      clinician.overallStatus = determineOverallStatus(clinician);

      // Update summary counts
      if (clinician.overallStatus === 'COMPLIANT') summary.compliant++;
      else if (clinician.overallStatus === 'DUE_SOON') summary.dueSoon++;
      else if (clinician.overallStatus === 'OVERDUE') summary.overdue++;
      else if (clinician.overallStatus === 'NOT_STARTED') summary.notStarted++;

      clinicians.push(clinician);
    }

    // Apply filters
    let filteredClinicians = clinicians;

    if (status) {
      filteredClinicians = filteredClinicians.filter(
        c => c.overallStatus === (status as string).toUpperCase()
      );
    }

    if (overdue === 'true') {
      filteredClinicians = filteredClinicians.filter(
        c => c.overallStatus === 'OVERDUE'
      );
    }

    // Sort by overall status priority (OVERDUE first)
    const statusPriority = { OVERDUE: 1, DUE_SOON: 2, NOT_STARTED: 3, COMPLIANT: 4 };
    filteredClinicians.sort((a, b) => {
      return statusPriority[a.overallStatus] - statusPriority[b.overallStatus];
    });

    const report: FppeOppeComplianceReport = {
      orgId,
      generatedAt: new Date().toISOString(),
      summary,
      clinicians: filteredClinicians
    };

    // Return CSV if requested
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="fppe-oppe-compliance-${orgId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Return JSON by default
    res.json(report);
  } catch (error) {
    console.error('Error generating FPPE/OPPE compliance report:', error);
    res.status(500).json({
      error: 'report_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

