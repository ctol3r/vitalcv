import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger';
import { createFPPECaseForApprovedPrivilege } from '../../privileging/hooks/onPrivilegeApproved';
import {
  resolveClinicianContext,
  fetchClinicianCredentials,
  fetchStateLicenses,
  buildCheck,
  emitTimelineEvent,
  getPrismaClient,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const prisma = getPrismaClient();
const logger = getServiceLogger('agent/routines/autoPrivilegeValidation');

type PrivilegeRequirements = {
  boardCertRequired?: boolean;
  licenseActive?: boolean;
  npdbClean?: boolean;
  specialtyMatch?: string[];
  additionalCriteria?: Record<string, unknown>;
};

function parseRequirements(value: unknown): PrivilegeRequirements | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  return value as PrivilegeRequirements;
}

function evaluatePrivilegeReadiness(options: {
  requirements: PrivilegeRequirements | null;
  hasBoard: boolean;
  hasLicense: boolean;
  npdbClear: boolean;
  specialty: string;
}): string[] {
  const issues: string[] = [];
  const { requirements, hasBoard, hasLicense, npdbClear, specialty } = options;

  if (requirements?.boardCertRequired && !hasBoard) {
    issues.push('Board certification required.');
  }
  if (requirements?.licenseActive !== false && !hasLicense) {
    issues.push('Active state license required.');
  }
  if (requirements?.npdbClean && !npdbClear) {
    issues.push('NPDB adverse action blocks privileges.');
  }
  if (requirements?.specialtyMatch && requirements.specialtyMatch.length > 0) {
    const matches = requirements.specialtyMatch.some(spec =>
      specialty.toLowerCase().includes(spec.toLowerCase()),
    );
    if (!matches) {
      issues.push(`Specialty must match one of: ${requirements.specialtyMatch.join(', ')}.`);
    }
  }
  return issues;
}

async function recordPrivilegeHoldTimeline(
  clinicianId: string,
  check: RoutineCheckResult,
  dryRun?: boolean,
) {
  await emitTimelineEvent({
    clinicianId,
    eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
    severity: check.timelineSeverity,
    metadata: check.evidence,
    dryRun,
  });
}

export async function runAutoPrivilegeValidationRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    if (!resolved.clinicianDid) {
      throw new Error('Clinician DID is required for privilege validation.');
    }

    const [privileges, licenses, credentials, npdbMonitor, pendingRequests] = await Promise.all([
      prisma.privilegeGranted.findMany({
        where: { clinicianDid: resolved.clinicianDid },
        include: {
          privilegeRequest: {
            include: {
              privilegeSet: true,
            },
          },
          fppeCases: {
            where: { status: { in: ['OPEN', 'IN_REVIEW'] } },
          },
        },
      }),
      fetchStateLicenses(resolved.clinicianId),
      fetchClinicianCredentials(resolved.userId),
      prisma.npdbOigMonitor.findFirst({
        where: { clinicianDid: resolved.clinicianDid },
        orderBy: { checkDate: 'desc' },
      }),
      prisma.privilegeRequest.findMany({
        where: {
          clinicianDid: resolved.clinicianDid,
          status: { in: ['PENDING', 'UNDER_REVIEW'] },
        },
        include: {
          privilegeSet: true,
        },
      }),
    ]);

    const hasBoard = credentials.some(
      credential => credential.type === 'BoardCertification' && credential.status === 'active',
    );
    const hasLicense = licenses.some(
      license =>
        license.status === 'ACTIVE' &&
        (!license.expiryDate || license.expiryDate.getTime() > Date.now()),
    );
    const npdbClean = !npdbMonitor || npdbMonitor.status !== 'ADVERSE_ACTION';

    for (const privilege of privileges) {
      const requirements = parseRequirements(
        privilege.privilegeRequest.privilegeSet?.requirements ?? null,
      );
      const issues = evaluatePrivilegeReadiness({
        requirements,
        hasBoard,
        hasLicense,
        npdbClear: npdbClean,
        specialty: resolved.specialty,
      });

      const hasOpenFPPE = privilege.fppeCases.some(
        fppe => fppe.status === 'OPEN' || fppe.status === 'IN_REVIEW',
      );
      const status: RoutineCheckResult['status'] = issues.length ? 'fail' : hasOpenFPPE ? 'pass' : 'warning';

      const check = buildCheck({
        id: `priv-${privilege.id}`,
        title: `Privilege ${privilege.privilegeRequest.privilegeSet?.name ?? privilege.privilegeSetId}`,
        status,
        summary:
          issues.length > 0
            ? issues.join(' ')
            : hasOpenFPPE
            ? 'Privilege cleared with active FPPE.'
            : 'Privilege eligible – FPPE launch required.',
        evidence: {
          privilegeGrantedId: privilege.id,
          privilegeRequestId: privilege.privilegeRequestId,
          requirements,
          issues,
        },
        timelineEvent: issues.length
          ? CredentialTimelineEventType.DISCREPANCY_FOUND
          : undefined,
      });
      checks.push(check);

      if (issues.length > 0) {
        if (!context.dryRun && privilege.status !== 'HOLD') {
          await prisma.privilegeGranted.update({
            where: { id: privilege.id },
            data: {
              status: 'HOLD',
              updatedAt: new Date(),
              revocationReason: 'Auto-validation hold due to missing prerequisites.',
            },
          });
        }
        await recordPrivilegeHoldTimeline(resolved.clinicianId, check, context.dryRun);
        recommendations.push({
          id: `hold-${privilege.id}`,
          label: 'Review privilege due to missing prerequisites',
          detail: issues.join(' '),
          type: 'alert',
        });
        continue;
      }

      if (!hasOpenFPPE) {
        if (!context.dryRun) {
          await createFPPECaseForApprovedPrivilege({
            privilegeGrantedId: privilege.id,
            privilegeRequestId: privilege.privilegeRequestId,
            clinicianId: resolved.clinicianDid,
            orgId: privilege.orgId,
            privilegeCode:
              privilege.privilegeRequest.privilegeSet?.name ?? privilege.privilegeSetId,
            reviewerDid: context.initiatedBy,
          });
        }

        const fppeCheck = buildCheck({
          id: `fppe-${privilege.id}`,
          title: 'FPPE initiation',
          status: 'warning',
          summary: 'FPPE launched to satisfy privileging prerequisites.',
          timelineEvent: CredentialTimelineEventType.FPPE_STARTED,
        });
        checks.push(fppeCheck);
        await emitTimelineEvent({
          clinicianId: resolved.clinicianId,
          eventType: CredentialTimelineEventType.FPPE_STARTED,
          severity: TimelineEventSeverity.WARNING,
          metadata: { privilegeGrantedId: privilege.id },
          dryRun: context.dryRun,
        });

        recommendations.push({
          id: `fppe-${privilege.id}`,
          label: 'Track FPPE completion',
          detail: 'Monitor FPPE checklist until completion.',
          type: 'fppe',
        });
      }
    }

    for (const request of pendingRequests) {
      const requirements = parseRequirements(request.privilegeSet?.requirements ?? null);
      const issues = evaluatePrivilegeReadiness({
        requirements,
        hasBoard,
        hasLicense,
        npdbClear: npdbClean,
        specialty: resolved.specialty,
      });

      const requestCheck = buildCheck({
        id: `request-${request.id}`,
        title: `Privilege request ${request.privilegeSet?.name ?? request.privilegeSetId}`,
        status: issues.length ? 'warning' : 'pass',
        summary: issues.length
          ? issues.join(' ')
          : 'Prerequisites satisfied – ready for committee review.',
        evidence: {
          privilegeRequestId: request.id,
          requirements,
          issues,
        },
      });
      checks.push(requestCheck);

      if (issues.length) {
        recommendations.push({
          id: `request-${request.id}-evidence`,
          label: 'Update privilege request evidence',
          detail: issues.join(' '),
          type: 'task',
        });
      }
    }

    const summary = `${checks.length} privilege evaluations processed`;
    return {
      routineId: 'auto-privilege-validation',
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
    logger.error('[autoPrivilegeValidation] routine failed', error);
    return {
      routineId: 'auto-privilege-validation',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto privilege validation routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}
