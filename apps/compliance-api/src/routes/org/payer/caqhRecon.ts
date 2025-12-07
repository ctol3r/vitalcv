/**
 * B137C-REPORT-002: CAQH vs VC vs NCQA Evidence Reconciliation Report
 *
 * Shows mismatches between CAQH ProView, VC evidence, and PSV (Primary Source Verification)
 * Exports to CSV with NCQA-friendly columns for CR1-CR5 audit support
 *
 * Acceptance Criteria:
 * - Shows mismatches between CAQH, VC, and PSV
 * - Exports CSV with NCQA-friendly columns
 * - Highlights discrepancies for audit trail
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface EvidenceSource {
  source: string;
  value: string | null;
  lastVerified?: string;
  status: string;
}

interface ReconciliationItem {
  clinicianDid: string;
  clinicianNpi?: string;
  field: string;
  caqh: EvidenceSource;
  vc: EvidenceSource;
  psv: EvidenceSource;
  mismatch: boolean;
  mismatchType?: 'VALUE_DIFF' | 'MISSING_SOURCE' | 'STATUS_DIFF' | 'DATE_STALE';
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  ncqaRequirement?: string; // CR1, CR2, CR3, CR4, or CR5
}

interface CaqhReconciliationReport {
  orgId: string;
  generatedAt: string;
  summary: {
    totalClinicians: number;
    totalFields: number;
    mismatches: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
    byNcqaRequirement: Record<string, number>;
  };
  items: ReconciliationItem[];
}

/**
 * Map fields to NCQA credentialing requirements
 */
function getNCQARequirement(field: string): string {
  const ncqaMap: Record<string, string> = {
    license: 'CR1', // Current license
    board_certification: 'CR2', // Board certification
    education: 'CR3', // Education and training
    work_history: 'CR4', // Work history
    malpractice: 'CR5', // Malpractice claims history
    hospital_privileges: 'CR4',
    dea: 'CR1',
    npi: 'CR1'
  };
  return ncqaMap[field] || 'OTHER';
}

/**
 * Determine risk level based on mismatch type and field
 */
function calculateRiskLevel(field: string, mismatchType: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const criticalFields = ['license', 'dea', 'board_certification', 'malpractice'];

  if (criticalFields.includes(field) && mismatchType === 'VALUE_DIFF') {
    return 'HIGH';
  }

  if (mismatchType === 'MISSING_SOURCE') {
    return 'MEDIUM';
  }

  if (mismatchType === 'DATE_STALE') {
    return 'LOW';
  }

  return 'MEDIUM';
}

/**
 * Convert report to CSV format with NCQA-friendly columns
 */
function convertToCSV(report: CaqhReconciliationReport): string {
  const headers = [
    'Clinician DID',
    'Clinician NPI',
    'Field',
    'NCQA Requirement',
    'CAQH Value',
    'CAQH Last Verified',
    'CAQH Status',
    'VC Value',
    'VC Last Verified',
    'VC Status',
    'PSV Value',
    'PSV Last Verified',
    'PSV Status',
    'Mismatch',
    'Mismatch Type',
    'Risk Level'
  ].join(',');

  const rows = report.items.map(item => {
    return [
      item.clinicianDid,
      item.clinicianNpi || '',
      item.field,
      item.ncqaRequirement || '',
      `"${item.caqh.value || ''}"`,
      item.caqh.lastVerified || '',
      item.caqh.status,
      `"${item.vc.value || ''}"`,
      item.vc.lastVerified || '',
      item.vc.status,
      `"${item.psv.value || ''}"`,
      item.psv.lastVerified || '',
      item.psv.status,
      item.mismatch ? 'YES' : 'NO',
      item.mismatchType || '',
      item.riskLevel
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * GET /org/:orgId/payer/caqh-recon
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - mismatchOnly: 'true' to show only mismatches (default: 'false')
 * - riskLevel: Filter by risk level (HIGH, MEDIUM, LOW)
 * - ncqaRequirement: Filter by NCQA requirement (CR1-CR5)
 *
 * Returns CAQH vs VC vs PSV reconciliation report
 */
router.get('/org/:orgId/payer/caqh-recon', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { format = 'json', mismatchOnly = 'false', riskLevel, ncqaRequirement } = req.query;

    // Fetch all payer enrollments for the organization with CAQH IDs
    const enrollments = await prisma.payerEnrollment.findMany({
      where: {
        orgId,
        caqhId: {
          not: null
        }
      },
      include: {
        auditEvents: {
          where: {
            source: {
              in: ['CAQH', 'VC', 'PSV']
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (enrollments.length === 0) {
      return res.status(404).json({
        error: 'no_enrollments_found',
        error_description: `No CAQH enrollments found for organization ${orgId}`
      });
    }

    const items: ReconciliationItem[] = [];

    // Fields to reconcile
    const fieldsToCheck = [
      'license',
      'board_certification',
      'education',
      'work_history',
      'malpractice',
      'hospital_privileges',
      'dea',
      'npi'
    ];

    for (const enrollment of enrollments) {
      // Group audit events by source and event type
      const caqhEvents = enrollment.auditEvents.filter(e => e.source === 'CAQH');
      const vcEvents = enrollment.auditEvents.filter(e => e.source === 'VC');
      const psvEvents = enrollment.auditEvents.filter(e => e.source === 'PSV');

      for (const field of fieldsToCheck) {
        // Extract most recent values from each source
        const caqhValue = caqhEvents.find(e =>
          e.metadata &&
          typeof e.metadata === 'object' &&
          'field' in e.metadata &&
          e.metadata.field === field
        );

        const vcValue = vcEvents.find(e =>
          e.metadata &&
          typeof e.metadata === 'object' &&
          'field' in e.metadata &&
          e.metadata.field === field
        );

        const psvValue = psvEvents.find(e =>
          e.metadata &&
          typeof e.metadata === 'object' &&
          'field' in e.metadata &&
          e.metadata.field === field
        );

        const caqhSource: EvidenceSource = {
          source: 'CAQH',
          value: caqhValue?.metadata && typeof caqhValue.metadata === 'object' && 'value' in caqhValue.metadata
            ? String(caqhValue.metadata.value)
            : null,
          lastVerified: caqhValue?.createdAt.toISOString(),
          status: caqhValue?.result || 'MISSING'
        };

        const vcSource: EvidenceSource = {
          source: 'VC',
          value: vcValue?.metadata && typeof vcValue.metadata === 'object' && 'value' in vcValue.metadata
            ? String(vcValue.metadata.value)
            : null,
          lastVerified: vcValue?.createdAt.toISOString(),
          status: vcValue?.result || 'MISSING'
        };

        const psvSource: EvidenceSource = {
          source: 'PSV',
          value: psvValue?.metadata && typeof psvValue.metadata === 'object' && 'value' in psvValue.metadata
            ? String(psvValue.metadata.value)
            : null,
          lastVerified: psvValue?.createdAt.toISOString(),
          status: psvValue?.result || 'MISSING'
        };

        // Determine if there's a mismatch
        const values = [caqhSource.value, vcSource.value, psvSource.value].filter(v => v !== null);
        const uniqueValues = new Set(values);
        const hasMismatch = uniqueValues.size > 1 || values.length < 3;

        let mismatchType: ReconciliationItem['mismatchType'] | undefined;

        if (hasMismatch) {
          if (values.length < 3) {
            mismatchType = 'MISSING_SOURCE';
          } else if (uniqueValues.size > 1) {
            mismatchType = 'VALUE_DIFF';
          }
        }

        // Check for stale data (older than 90 days)
        const now = Date.now();
        const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);

        const isStale = [caqhSource, vcSource, psvSource].some(source => {
          if (!source.lastVerified) return false;
          return new Date(source.lastVerified).getTime() < ninetyDaysAgo;
        });

        if (isStale && !mismatchType) {
          mismatchType = 'DATE_STALE';
        }

        const ncqaReq = getNCQARequirement(field);
        const riskLvl = mismatchType ? calculateRiskLevel(field, mismatchType) : 'LOW';

        const item: ReconciliationItem = {
          clinicianDid: enrollment.clinicianDid,
          field,
          caqh: caqhSource,
          vc: vcSource,
          psv: psvSource,
          mismatch: hasMismatch || isStale,
          mismatchType,
          riskLevel: riskLvl,
          ncqaRequirement: ncqaReq
        };

        items.push(item);
      }
    }

    // Apply filters
    let filteredItems = items;

    if (mismatchOnly === 'true') {
      filteredItems = filteredItems.filter(item => item.mismatch);
    }

    if (riskLevel) {
      filteredItems = filteredItems.filter(item => item.riskLevel === (riskLevel as string).toUpperCase());
    }

    if (ncqaRequirement) {
      filteredItems = filteredItems.filter(item => item.ncqaRequirement === (ncqaRequirement as string).toUpperCase());
    }

    // Calculate summary
    const summary = {
      totalClinicians: enrollments.length,
      totalFields: items.length,
      mismatches: items.filter(i => i.mismatch).length,
      highRisk: items.filter(i => i.riskLevel === 'HIGH').length,
      mediumRisk: items.filter(i => i.riskLevel === 'MEDIUM').length,
      lowRisk: items.filter(i => i.riskLevel === 'LOW').length,
      byNcqaRequirement: items.reduce((acc, item) => {
        const req = item.ncqaRequirement || 'OTHER';
        acc[req] = (acc[req] || 0) + (item.mismatch ? 1 : 0);
        return acc;
      }, {} as Record<string, number>)
    };

    const report: CaqhReconciliationReport = {
      orgId,
      generatedAt: new Date().toISOString(),
      summary,
      items: filteredItems
    };

    // Return CSV format if requested
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="caqh-reconciliation-${orgId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Return JSON by default
    res.json(report);
  } catch (error) {
    console.error('Error generating CAQH reconciliation report:', error);
    res.status(500).json({
      error: 'report_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

