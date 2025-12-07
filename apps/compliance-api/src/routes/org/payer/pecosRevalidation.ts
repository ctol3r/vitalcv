/**
 * B137C-PECOS-003: PECOS Revalidation Report
 *
 * Lists enrollments due for revalidation based on 5-year (Medicare Part A/B)
 * and 3-year (Medicare Advantage, DME) windows
 * Includes deadlines and CSV export support
 *
 * Acceptance Criteria:
 * - Lists enrollments due for revalidation
 * - Includes 5-year and 3-year revalidation windows
 * - Shows deadlines and alert levels
 * - CSV export supported
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface RevalidationItem {
  enrollmentId: string;
  clinicianDid: string;
  clinicianNpi?: string;
  payerId: string;
  payerName: string;
  pecosId: string;
  pecosEnrollmentId?: string;
  cycle: '5year' | '3year';
  enrollmentType: string; // 'MEDICARE_AB' | 'MEDICARE_ADVANTAGE' | 'DME'
  lastRevalidated?: string;
  dueDate: string;
  daysUntilDue: number;
  alertLevel: 'OVERDUE' | 'CRITICAL' | 'WARNING' | 'UPCOMING' | 'OK';
  status: string; // Current PECOS status
  recommendedAction: string;
  form: '855I' | '855R' | '855B'; // CMS form type
}

interface PecosRevalidationReport {
  orgId: string;
  generatedAt: string;
  summary: {
    totalEnrollments: number;
    overdue: number;
    critical: number; // Within 30 days
    warning: number; // Within 90 days
    upcoming: number; // Within 180 days
    ok: number;
    byCycle: {
      '5year': number;
      '3year': number;
    };
    byForm: {
      '855I': number;
      '855R': number;
      '855B': number;
    };
  };
  items: RevalidationItem[];
}

/**
 * Determine revalidation cycle based on enrollment type
 */
function getRevalidationCycle(enrollmentType: string): '5year' | '3year' {
  const threeYearTypes = ['MEDICARE_ADVANTAGE', 'DME', 'MEDICAID'];
  return threeYearTypes.includes(enrollmentType) ? '3year' : '5year';
}

/**
 * Determine appropriate CMS form based on enrollment type
 */
function getCMSForm(enrollmentType: string): '855I' | '855R' | '855B' {
  if (enrollmentType.includes('INDIVIDUAL')) return '855I';
  if (enrollmentType.includes('REASSIGNMENT')) return '855R';
  return '855B'; // Default to business/organizational
}

/**
 * Calculate alert level based on days until due
 */
function calculateAlertLevel(daysUntilDue: number): RevalidationItem['alertLevel'] {
  if (daysUntilDue < 0) return 'OVERDUE';
  if (daysUntilDue <= 30) return 'CRITICAL';
  if (daysUntilDue <= 90) return 'WARNING';
  if (daysUntilDue <= 180) return 'UPCOMING';
  return 'OK';
}

/**
 * Get recommended action based on alert level
 */
function getRecommendedAction(alertLevel: RevalidationItem['alertLevel'], form: string): string {
  switch (alertLevel) {
    case 'OVERDUE':
      return `URGENT: Submit CMS ${form} immediately to avoid payment holds`;
    case 'CRITICAL':
      return `HIGH PRIORITY: Complete CMS ${form} within 30 days`;
    case 'WARNING':
      return `ATTENTION: Begin CMS ${form} preparation within 90 days`;
    case 'UPCOMING':
      return `PLAN AHEAD: CMS ${form} due within 6 months`;
    default:
      return 'Monitor for upcoming deadline';
  }
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Convert report to CSV format
 */
function convertToCSV(report: PecosRevalidationReport): string {
  const headers = [
    'Enrollment ID',
    'Clinician DID',
    'Clinician NPI',
    'Payer ID',
    'Payer Name',
    'PECOS ID',
    'PECOS Enrollment ID',
    'Cycle',
    'Enrollment Type',
    'Last Revalidated',
    'Due Date',
    'Days Until Due',
    'Alert Level',
    'Status',
    'CMS Form',
    'Recommended Action'
  ].join(',');

  const rows = report.items.map(item => {
    return [
      item.enrollmentId,
      item.clinicianDid,
      item.clinicianNpi || '',
      item.payerId,
      `"${item.payerName}"`,
      item.pecosId,
      item.pecosEnrollmentId || '',
      item.cycle,
      item.enrollmentType,
      item.lastRevalidated || '',
      item.dueDate,
      item.daysUntilDue,
      item.alertLevel,
      item.status,
      item.form,
      `"${item.recommendedAction}"`
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * GET /org/:orgId/payer/pecos-revalidation
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - alertLevel: Filter by alert level (OVERDUE, CRITICAL, WARNING, UPCOMING, OK)
 * - cycle: Filter by revalidation cycle (5year, 3year)
 * - dueBefore: ISO date string - show only items due before this date
 *
 * Returns PECOS revalidation report with 5-year and 3-year windows
 */
router.get('/org/:orgId/payer/pecos-revalidation', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { format = 'json', alertLevel, cycle, dueBefore } = req.query;

    // Fetch all payer enrollments with PECOS IDs for the organization
    const enrollments = await prisma.payerEnrollment.findMany({
      where: {
        orgId,
        pecosId: {
          not: null
        }
      },
      include: {
        payer: {
          select: {
            id: true,
            name: true,
            payerId: true,
            requiresPecos: true
          }
        }
      }
    });

    // Also fetch explicit PECOS revalidation records
    const pecosRevalidations = await prisma.pecosRevalidation.findMany({
      where: {
        completed: false
      }
    });

    if (enrollments.length === 0 && pecosRevalidations.length === 0) {
      return res.status(404).json({
        error: 'no_pecos_enrollments_found',
        error_description: `No PECOS enrollments found for organization ${orgId}`
      });
    }

    const now = new Date();
    const items: RevalidationItem[] = [];

    // Process payer enrollments
    for (const enrollment of enrollments) {
      // Determine enrollment type from metadata
      const enrollmentType = (enrollment.metadata as any)?.enrollmentType || 'MEDICARE_AB';
      const revalidationCycle = getRevalidationCycle(enrollmentType);
      const cmsForm = getCMSForm(enrollmentType);

      // Calculate due date based on last revalidation
      let dueDate: Date;
      const lastRevalidated = enrollment.approvedAt || enrollment.createdAt;

      if (enrollment.revalidationDueAt) {
        dueDate = enrollment.revalidationDueAt;
      } else {
        // Calculate based on cycle
        const yearsToAdd = revalidationCycle === '5year' ? 5 : 3;
        dueDate = new Date(lastRevalidated);
        dueDate.setFullYear(dueDate.getFullYear() + yearsToAdd);
      }

      const daysUntilDue = daysBetween(now, dueDate);
      const alertLvl = calculateAlertLevel(daysUntilDue);

      const item: RevalidationItem = {
        enrollmentId: enrollment.id,
        clinicianDid: enrollment.clinicianDid,
        payerId: enrollment.payer.payerId,
        payerName: enrollment.payer.name,
        pecosId: enrollment.pecosId!,
        pecosEnrollmentId: enrollment.pecosEnrollmentId || undefined,
        cycle: revalidationCycle,
        enrollmentType,
        lastRevalidated: lastRevalidated.toISOString(),
        dueDate: dueDate.toISOString(),
        daysUntilDue,
        alertLevel: alertLvl,
        status: enrollment.pecosStatus || enrollment.status,
        form: cmsForm,
        recommendedAction: getRecommendedAction(alertLvl, cmsForm)
      };

      items.push(item);
    }

    // Process explicit PECOS revalidation records
    for (const revalidation of pecosRevalidations) {
      const daysUntilDue = daysBetween(now, revalidation.dueDate);
      const alertLvl = calculateAlertLevel(daysUntilDue);
      const cmsForm = getCMSForm('MEDICARE_AB'); // Default assumption

      const item: RevalidationItem = {
        enrollmentId: revalidation.id,
        clinicianDid: revalidation.npi, // Using NPI as proxy for DID
        clinicianNpi: revalidation.npi,
        payerId: 'CMS',
        payerName: 'Centers for Medicare & Medicaid Services',
        pecosId: revalidation.npi,
        cycle: revalidation.cycle as '5year' | '3year',
        enrollmentType: revalidation.cycle === '5year' ? 'MEDICARE_AB' : 'MEDICARE_ADVANTAGE',
        dueDate: revalidation.dueDate.toISOString(),
        daysUntilDue,
        alertLevel: alertLvl,
        status: revalidation.completed ? 'COMPLETED' : 'PENDING',
        form: cmsForm,
        recommendedAction: getRecommendedAction(alertLvl, cmsForm)
      };

      items.push(item);
    }

    // Apply filters
    let filteredItems = items;

    if (alertLevel) {
      filteredItems = filteredItems.filter(item => item.alertLevel === (alertLevel as string).toUpperCase());
    }

    if (cycle) {
      filteredItems = filteredItems.filter(item => item.cycle === cycle);
    }

    if (dueBefore) {
      const dueBeforeDate = new Date(dueBefore as string);
      filteredItems = filteredItems.filter(item => new Date(item.dueDate) <= dueBeforeDate);
    }

    // Sort by days until due (most urgent first)
    filteredItems.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    // Calculate summary
    const summary = {
      totalEnrollments: items.length,
      overdue: items.filter(i => i.alertLevel === 'OVERDUE').length,
      critical: items.filter(i => i.alertLevel === 'CRITICAL').length,
      warning: items.filter(i => i.alertLevel === 'WARNING').length,
      upcoming: items.filter(i => i.alertLevel === 'UPCOMING').length,
      ok: items.filter(i => i.alertLevel === 'OK').length,
      byCycle: {
        '5year': items.filter(i => i.cycle === '5year').length,
        '3year': items.filter(i => i.cycle === '3year').length
      },
      byForm: {
        '855I': items.filter(i => i.form === '855I').length,
        '855R': items.filter(i => i.form === '855R').length,
        '855B': items.filter(i => i.form === '855B').length
      }
    };

    const report: PecosRevalidationReport = {
      orgId,
      generatedAt: new Date().toISOString(),
      summary,
      items: filteredItems
    };

    // Return CSV format if requested
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="pecos-revalidation-${orgId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Return JSON by default
    res.json(report);
  } catch (error) {
    console.error('Error generating PECOS revalidation report:', error);
    res.status(500).json({
      error: 'report_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

