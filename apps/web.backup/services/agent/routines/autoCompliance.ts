import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { calculateNCQAComplianceRecords } from '../../compliance/ncqa/calcNCQA';
import {
  NCQAComplianceStatus,
  shouldAlertOnCompliance,
} from '../../compliance/models/NCQAComplianceRecord';
import { getServiceLogger } from '../../logging/serviceLogger';
import { createFPPECaseForApprovedPrivilege } from '../../privileging/hooks/onPrivilegeApproved';
import {
  resolveClinicianContext,
  buildCheck,
  emitTimelineEvent,
  getPrismaClient,
  upsertRevalidationTask,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const prisma = getPrismaClient();
const logger = getServiceLogger('agent/routines/autoCompliance');

export async function runAutoComplianceRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    const [records, privileges] = await Promise.all([
      calculateNCQAComplianceRecords(resolved.clinicianId, { prisma }),
      prisma.privilegeGranted.findMany({
        where: { clinicianDid: resolved.clinicianDid ?? '' },
        include: {
          privilegeRequest: {
            include: { privilegeSet: true },
          },
          fppeCases: {
            where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
          },
        },
      }),
    ]);

    for (const record of records) {
      await prisma.nCQAComplianceRecord.upsert({
        where: {
          clinicianId_ruleCode: {
            clinicianId: resolved.clinicianId,
            ruleCode: record.ruleCode,
          },
        },
        update: {
          status: record.status as NCQAComplianceStatus,
          lastVerifiedAt: record.lastVerifiedAt,
          nextDueAt: record.nextDueAt,
          evidenceRefs: record.evidenceRefs as any,
          notes: record.notes,
          metadata: record.metadata as any,
        },
        create: {
          clinicianId: resolved.clinicianId,
          ruleCode: record.ruleCode,
          status: record.status as NCQAComplianceStatus,
          lastVerifiedAt: record.lastVerifiedAt,
          nextDueAt: record.nextDueAt,
          evidenceRefs: record.evidenceRefs as any,
          notes: record.notes,
          metadata: record.metadata as any,
        },
      });

      const status =
        record.status === 'FAIL'
          ? 'fail'
          : record.status === 'WARN' || record.status === 'PENDING'
          ? 'warning'
          : 'pass';

      const check = buildCheck({
        id: `ncqa-${record.ruleCode}`,
        title: `NCQA ${record.ruleCode}`,
        status,
        summary: record.notes,
        evidence: {
          evidenceRefs: record.evidenceRefs,
        },
        timelineEvent:
          status !== 'pass' ? CredentialTimelineEventType.DISCREPANCY_FOUND : undefined,
      });
      checks.push(check);

      if (status !== 'pass') {
        await emitTimelineEvent({
          clinicianId: resolved.clinicianId,
          eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
          severity: check.timelineSeverity ?? TimelineEventSeverity.WARNING,
          metadata: {
            ruleCode: record.ruleCode,
            status: record.status,
            notes: record.notes,
          },
          dryRun: context.dryRun,
        });
      }

      if (record.ruleCode === 'CR1' || record.ruleCode === 'CR2') {
        if (shouldAlertOnCompliance(record)) {
          recommendations.push({
            id: `reval-${record.ruleCode}`,
            label: 'Start credential revalidation review',
            detail: record.notes,
            type: 'task',
          });
          await upsertRevalidationTask({
            clinicianId: resolved.clinicianId,
            type: 'CREDENTIALING',
            dueDate: record.nextDueAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            notes: `NCQA ${record.ruleCode} remediation`,
            metadata: { ruleCode: record.ruleCode },
            dryRun: context.dryRun,
          });
        }
      }

      if (record.ruleCode === 'CR5' && shouldAlertOnCompliance(record) && privileges.length) {
        const targetPrivilege = privileges.find(privilege =>
          privilege.fppeCases.every(
            fppe => fppe.status !== 'OPEN' && fppe.status !== 'IN_REVIEW',
          ),
        );

        if (targetPrivilege && !context.dryRun) {
          await createFPPECaseForApprovedPrivilege({
            privilegeGrantedId: targetPrivilege.id,
            privilegeRequestId: targetPrivilege.privilegeRequestId,
            clinicianId: resolved.clinicianDid ?? resolved.clinicianId,
            orgId: targetPrivilege.orgId,
            privilegeCode:
              targetPrivilege.privilegeRequest.privilegeSet?.name ??
              targetPrivilege.privilegeSetId,
            reviewerDid: context.initiatedBy,
          });
          recommendations.push({
            id: `fppe-${targetPrivilege.id}`,
            label: 'Launch FPPE cycle',
            detail: 'OPPE metrics stale – FPPE initiated automatically.',
            type: 'fppe',
          });
        }
      }
    }

    const summary = `${checks.filter(check => check.status === 'fail').length} fail, ${
      checks.filter(check => check.status === 'warning').length
    } warn`;
    return {
      routineId: 'auto-compliance',
      clinicianId: resolved.clinicianId,
      clinicianDid: resolved.clinicianDid,
      npi: resolved.npi,
      startedAt,
      completedAt: new Date(),
      status: 'completed',
      summary,
      checks,
      recommendations,
    };
  } catch (error) {
    logger.error('[autoCompliance] routine failed', error);
    return {
      routineId: 'auto-compliance',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto compliance routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}


