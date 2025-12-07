/**
 * B135C-REPORT-003: NPDB-related privilege actions report
 *
 * Lists privileges moved to HOLD/DENIED due to NPDB findings
 * Includes timestamps, reviewers, and adverse action details
 *
 * Acceptance Criteria:
 * - Lists privileges moved to HOLD/DENIED due to NPDB
 * - Includes timestamps & reviewers
 * - JSON and CSV export
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface NpdbPrivilegeAction {
  id: string;
  clinicianDid: string;
  clinicianNpi?: string;
  clinicianName?: string;
  privilegeRequestId: string;
  privilegeSetName: string;
  department: string;
  npdbCheckId: string;
  npdbCheckDate: string;
  adverseActionType: string;
  adverseActionDate?: string;
  adverseActionDescription: string;
  privilegeAction: 'HOLD' | 'DENIED' | 'REVOKED';
  actionTakenDate: string;
  reviewerDid?: string;
  reviewerName?: string;
  reviewNotes?: string;
  notificationSent: boolean;
  status: string; // NPDB monitor status
}

interface NpdbPrivilegeActionsReport {
  orgId: string;
  generatedAt: string;
  dateRange: {
    from?: string;
    to?: string;
  };
  summary: {
    totalActions: number;
    byAction: {
      HOLD: number;
      DENIED: number;
      REVOKED: number;
    };
    byAdverseActionType: Record<string, number>;
    notificationsSent: number;
  };
  actions: NpdbPrivilegeAction[];
}

/**
 * Parse adverse actions from NPDB response JSON
 */
function parseAdverseActions(adverseActions: any): {
  type: string;
  date?: string;
  description: string;
}[] {
  if (!adverseActions || !Array.isArray(adverseActions)) {
    return [];
  }

  return adverseActions.map(action => ({
    type: action.type || action.actionType || 'Unknown',
    date: action.date || action.actionDate,
    description: action.description || action.narrative || 'No description provided'
  }));
}

/**
 * Convert report to CSV format
 */
function convertToCSV(report: NpdbPrivilegeActionsReport): string {
  const headers = [
    'Action ID',
    'Clinician DID',
    'Clinician NPI',
    'Privilege Set',
    'Department',
    'NPDB Check Date',
    'Adverse Action Type',
    'Adverse Action Date',
    'Privilege Action',
    'Action Taken Date',
    'Reviewer DID',
    'Review Notes',
    'Notification Sent'
  ].join(',');

  const rows = report.actions.map(action => {
    // Escape CSV fields that may contain commas or quotes
    const escapeCSV = (field: string | undefined) => {
      if (!field) return '';
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    return [
      action.id,
      action.clinicianDid,
      action.clinicianNpi || '',
      escapeCSV(action.privilegeSetName),
      action.department,
      action.npdbCheckDate,
      action.adverseActionType,
      action.adverseActionDate || '',
      action.privilegeAction,
      action.actionTakenDate,
      action.reviewerDid || '',
      escapeCSV(action.reviewNotes),
      action.notificationSent ? 'YES' : 'NO'
    ].join(',');
  });

  return [headers, ...rows].join('\n');
}

/**
 * GET /org/:orgId/npdb/report
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 * - from: ISO date string (filter from date)
 * - to: ISO date string (filter to date)
 * - action: Filter by privilege action (HOLD, DENIED, REVOKED)
 * - department: Filter by department
 *
 * Returns all NPDB-related privilege actions for the organization
 */
router.get('/org/:orgId/npdb/report', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { format = 'json', from, to, action, department } = req.query;

    // Build date filter
    const dateFilter: any = {};
    if (from) {
      dateFilter.gte = new Date(from as string);
    }
    if (to) {
      dateFilter.lte = new Date(to as string);
    }

    // Fetch NPDB monitors that resulted in privilege actions
    const npdbMonitors = await prisma.npdbOigMonitor.findMany({
      where: {
        monitorType: 'NPDB',
        status: 'ADVERSE_ACTION',
        privilegeAction: {
          in: ['HOLD', 'REVOKE', 'DENY']
        },
        orgIds: {
          has: orgId
        },
        ...(Object.keys(dateFilter).length > 0 && { checkDate: dateFilter })
      },
      orderBy: {
        checkDate: 'desc'
      }
    });

    if (npdbMonitors.length === 0) {
      return res.json({
        orgId,
        generatedAt: new Date().toISOString(),
        dateRange: { from, to },
        summary: {
          totalActions: 0,
          byAction: { HOLD: 0, DENIED: 0, REVOKED: 0 },
          byAdverseActionType: {},
          notificationsSent: 0
        },
        actions: []
      });
    }

    // Get associated privilege requests
    const clinicianDids = npdbMonitors.map(m => m.clinicianDid);
    const privilegeRequests = await prisma.privilegeRequest.findMany({
      where: {
        orgId,
        clinicianDid: {
          in: clinicianDids
        },
        status: {
          in: ['HOLD', 'DENIED'] // These statuses correspond to NPDB actions
        }
      },
      include: {
        privilegeSet: true
      }
    });

    // Build a map of privilege requests by clinician DID
    const privilegeRequestMap = new Map(
      privilegeRequests.map(pr => [pr.clinicianDid, pr])
    );

    // Initialize summary statistics
    const summary = {
      totalActions: 0,
      byAction: {
        HOLD: 0,
        DENIED: 0,
        REVOKED: 0
      },
      byAdverseActionType: {} as Record<string, number>,
      notificationsSent: 0
    };

    const actions: NpdbPrivilegeAction[] = [];

    for (const monitor of npdbMonitors) {
      const privilegeRequest = privilegeRequestMap.get(monitor.clinicianDid);

      // Skip if no associated privilege request (might be a pre-employment check)
      if (!privilegeRequest) continue;

      // Skip if department filter doesn't match
      if (department && privilegeRequest.privilegeSet.department !== department) {
        continue;
      }

      const adverseActions = parseAdverseActions(monitor.adverseActions);

      // Handle multiple adverse actions (create one record per adverse action)
      for (const adverseAction of adverseActions) {
        const privilegeAction = monitor.privilegeAction === 'REVOKE' ? 'REVOKED' :
                                monitor.privilegeAction === 'DENY' ? 'DENIED' : 'HOLD';

        // Skip if action filter doesn't match
        if (action && privilegeAction !== (action as string).toUpperCase()) {
          continue;
        }

        const actionRecord: NpdbPrivilegeAction = {
          id: `${monitor.id}-${adverseAction.type}`,
          clinicianDid: monitor.clinicianDid,
          clinicianNpi: monitor.npi || undefined,
          privilegeRequestId: privilegeRequest.id,
          privilegeSetName: privilegeRequest.privilegeSet.name,
          department: privilegeRequest.privilegeSet.department,
          npdbCheckId: monitor.id,
          npdbCheckDate: monitor.checkDate.toISOString(),
          adverseActionType: adverseAction.type,
          adverseActionDate: adverseAction.date,
          adverseActionDescription: adverseAction.description,
          privilegeAction,
          actionTakenDate: privilegeRequest.reviewedAt?.toISOString() || monitor.createdAt.toISOString(),
          reviewerDid: privilegeRequest.reviewerDid || undefined,
          reviewNotes: privilegeRequest.reviewNotes || undefined,
          notificationSent: monitor.notificationSent,
          status: monitor.status
        };

        actions.push(actionRecord);

        // Update summary statistics
        summary.totalActions++;
        summary.byAction[privilegeAction]++;

        if (!summary.byAdverseActionType[adverseAction.type]) {
          summary.byAdverseActionType[adverseAction.type] = 0;
        }
        summary.byAdverseActionType[adverseAction.type]++;

        if (monitor.notificationSent) {
          summary.notificationsSent++;
        }
      }
    }

    // Sort by action taken date (most recent first)
    actions.sort((a, b) => {
      return new Date(b.actionTakenDate).getTime() - new Date(a.actionTakenDate).getTime();
    });

    const report: NpdbPrivilegeActionsReport = {
      orgId,
      generatedAt: new Date().toISOString(),
      dateRange: { from: from as string, to: to as string },
      summary,
      actions
    };

    // Return CSV if requested
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="npdb-privilege-actions-${orgId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Return JSON by default
    res.json(report);
  } catch (error) {
    console.error('Error generating NPDB privilege actions report:', error);
    res.status(500).json({
      error: 'report_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

