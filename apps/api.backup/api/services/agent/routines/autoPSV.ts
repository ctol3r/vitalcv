import {
  CredentialTimelineEventType,
  TimelineEventSeverity,
  type Credential,
  type PECOSProvider,
  type CaqhProfile,
} from '@prisma/client';
import { NPDBIntegrationService } from '../../privileging/npdbIntegration';
import { runPSV } from '../../psv/psvOrchestrator';
import {
  evaluatePayerEligibility,
  type CaqhSnapshot,
  type DeaSnapshot,
  type BoardCertificationSnapshot,
  type DeaSchedule,
} from '../../payer/eligibilityEngine';
import { detectPayerDiscrepancies } from '../../payer/detectPayerDiscrepancies';
import { getServiceLogger } from '../../logging/serviceLogger';
import {
  resolveClinicianContext,
  fetchClinicianCredentials,
  fetchStateLicenses,
  fetchPecosProviders,
  buildCheck,
  emitTimelineEvent,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const logger = getServiceLogger('agent/routines/autoPSV');
const npdbService = new NPDBIntegrationService();

const DEA_SCHEDULE_REQUIREMENTS: DeaSchedule[] = ['II', 'III'];

function selectActiveLicense(
  licenses: Awaited<ReturnType<typeof fetchStateLicenses>>,
  preferredState?: string,
) {
  const now = Date.now();
  const sorted = [...licenses].sort((a, b) => {
    const aTime = a.updatedAt?.getTime() ?? 0;
    const bTime = b.updatedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  const pick = sorted.find(
    license =>
      license.status === 'ACTIVE' &&
      (!license.expiryDate || license.expiryDate.getTime() > now) &&
      (!preferredState || license.state === preferredState),
  );

  if (pick) {
    return pick;
  }

  return sorted.find(
    license =>
      license.status === 'ACTIVE' &&
      (!license.expiryDate || license.expiryDate.getTime() > now),
  );
}

function isCredentialActive(credential: Credential): boolean {
  if (credential.status && credential.status.toLowerCase() !== 'active') {
    return false;
  }
  if (credential.expiresAt && credential.expiresAt.getTime() < Date.now()) {
    return false;
  }
  return true;
}

function buildBoardSnapshot(credentials: Credential[]): BoardCertificationSnapshot | undefined {
  const board = credentials.find(
    cred => cred.type === 'BoardCertification' && isCredentialActive(cred),
  );
  if (!board) {
    return undefined;
  }

  const metadata = (board.metadata as Record<string, unknown> | null) ?? {};
  return {
    specialty: (metadata.specialty as string) ?? 'General',
    status: 'ACTIVE',
    expiresOn: board.expiresAt ?? undefined,
  };
}

function buildDeaSnapshot(credentials: Credential[]): DeaSnapshot | undefined {
  const dea = credentials.find(
    cred => cred.type === 'DEARegistration' && isCredentialActive(cred),
  );
  if (!dea) {
    return undefined;
  }

  const metadata = (dea.metadata as Record<string, unknown> | null) ?? {};
  const schedules = Array.isArray(metadata.schedules)
    ? (metadata.schedules as string[])
    : metadata.schedule
    ? [String(metadata.schedule)]
    : DEA_SCHEDULE_REQUIREMENTS;

  return {
    registrationNumber: metadata.registrationNumber
      ? String(metadata.registrationNumber)
      : dea.id,
    schedules: schedules as DeaSchedule[],
    expiresOn: dea.expiresAt ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };
}

function buildCaqhSnapshot(profile?: CaqhProfile | null): CaqhSnapshot | undefined {
  if (!profile) {
    return undefined;
  }
  const fields = (profile.fields as Record<string, unknown> | null) ?? {};
  const completeness =
    typeof fields.completeness === 'number'
      ? Math.min(1, Math.max(0, fields.completeness))
      : 0.9;

  const attestedAt =
    typeof fields.attestedAt === 'string'
      ? fields.attestedAt
      : profile.lastSyncedAt?.toISOString();

  return {
    completeness,
    attestedAt,
    missingSections: Array.isArray(fields.missingSections)
      ? (fields.missingSections as string[])
      : undefined,
  };
}

function summarizePecosStatus(providers: PECOSProvider[]): {
  status: 'pass' | 'warning' | 'fail';
  notes: string;
  needsRevalidation: boolean;
} {
  if (!providers.length) {
    return {
      status: 'warning',
      notes: 'No PECOS provider records were found.',
      needsRevalidation: true,
    };
  }

  const latest = providers[0];
  if (latest.status === 'DEACTIVATED' || latest.status === 'REJECTED') {
    return {
      status: 'fail',
      notes: `PECOS status is ${latest.status}.`,
      needsRevalidation: true,
    };
  }

  const needsRevalidation =
    !!latest.revalidationDate && latest.revalidationDate.getTime() < Date.now();
  return {
    status: needsRevalidation ? 'warning' : 'pass',
    notes: needsRevalidation ? 'PECOS revalidation is overdue.' : 'PECOS enrollment is active.',
    needsRevalidation,
  };
}

async function recordCheckTimeline(
  clinicianId: string,
  check: RoutineCheckResult,
  dryRun?: boolean,
) {
  if (!check.timelineEvent) {
    return;
  }
  await emitTimelineEvent({
    clinicianId,
    eventType: check.timelineEvent,
    severity: check.timelineSeverity,
    metadata: check.evidence,
    dryRun,
  });
}

function collectPayerRecommendations(results: RoutineCheckResult[]): RoutineActionRecommendation[] {
  return results
    .filter(result => result.status !== 'pass' && result.metadata?.action)
    .map(result => ({
      id: `payer-${result.id}`,
      label: String(result.metadata?.action),
      detail: result.summary,
      type: 'task',
    }));
}

export async function runAutoPSVRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    const [licenses, credentials, pecosProviders] = await Promise.all([
      fetchStateLicenses(resolved.clinicianId),
      fetchClinicianCredentials(resolved.userId),
      fetchPecosProviders(resolved.clinicianId),
    ]);

    const activeLicense = selectActiveLicense(licenses, resolved.state);

    if (!activeLicense) {
      const licenseCheck = buildCheck({
        id: 'license',
        title: 'Active license required',
        status: 'fail',
        summary: 'No active state license could be located for PSV.',
        timelineEvent: CredentialTimelineEventType.LICENSE_VERIFIED,
      });
      checks.push(licenseCheck);
      await recordCheckTimeline(resolved.clinicianId, licenseCheck, context.dryRun);
    } else {
      const psvResult = await runPSV({
        clinicianId: resolved.clinicianId,
        clinicianDid: resolved.clinicianDid,
        orgId: context.orgIds?.[0],
        npi: resolved.npi,
        state: activeLicense.state,
        licenseNumber: activeLicense.licenseNumber,
      });

      if ('psvResultId' in psvResult) {
        const licenseCheck = buildCheck({
          id: 'license',
          title: 'Primary source verification',
          status: psvResult.overallStatus === 'PASS' ? 'pass' : 'warning',
          summary: psvResult.summary,
          evidence: {
            psvResultId: psvResult.psvResultId,
            licenseCheck: psvResult.licenseCheck,
            sanctionsCheck: psvResult.sanctionsCheck,
          },
          timelineEvent: CredentialTimelineEventType.LICENSE_VERIFIED,
        });
        checks.push(licenseCheck);
        await recordCheckTimeline(resolved.clinicianId, licenseCheck, context.dryRun);
      } else {
        const licenseCheck = buildCheck({
          id: 'license',
          title: 'Primary source verification',
          status: 'fail',
          summary: `PSV orchestrator error: ${psvResult.error}`,
          timelineEvent: CredentialTimelineEventType.LICENSE_VERIFIED,
          timelineSeverity: TimelineEventSeverity.CRITICAL,
        });
        checks.push(licenseCheck);
        await recordCheckTimeline(resolved.clinicianId, licenseCheck, context.dryRun);
      }
    }

    const demographics = resolved.demographics;
    const npdbResult = await npdbService.queryNPDB({
      npi: resolved.npi,
      firstName: demographics?.firstName,
      lastName: demographics?.lastName,
      dateOfBirth: demographics?.dateOfBirth,
      requestingOrganization: context.orgIds?.[0] ?? 'auto-psv',
      requestingOfficer: context.initiatedBy ?? 'Auto PSV Agent',
      purpose: 'renewal',
    });
    const npdbStatus =
      npdbResult.holdTriggered || npdbResult.status === 'hold_required'
        ? 'fail'
        : npdbResult.status === 'adverse_found'
        ? 'warning'
        : 'pass';
    const npdbCheck = buildCheck({
      id: 'npdb',
      title: 'NPDB adverse action review',
      status: npdbStatus,
      summary: npdbResult.holdReasons?.join('; ') ?? 'No adverse actions found.',
      evidence: {
        queryId: npdbResult.queryId,
        holdReasons: npdbResult.holdReasons,
        adverseActions: npdbResult.adverseActions,
      },
      timelineEvent: CredentialTimelineEventType.NPDB_QUERY,
    });
    checks.push(npdbCheck);
    await recordCheckTimeline(resolved.clinicianId, npdbCheck, context.dryRun);

    const boardSnapshot = buildBoardSnapshot(credentials);
    const boardCheck = buildCheck({
      id: 'board',
      title: 'Board certification',
      status: boardSnapshot ? 'pass' : 'fail',
      summary: boardSnapshot
        ? `Board certification active (${boardSnapshot.specialty}).`
        : 'No active board certification credential found.',
      evidence: boardSnapshot ? { expiresOn: boardSnapshot.expiresOn } : undefined,
      timelineEvent: CredentialTimelineEventType.BOARD_VERIFIED,
      timelineSeverity: boardSnapshot ? TimelineEventSeverity.INFO : TimelineEventSeverity.CRITICAL,
    });
    checks.push(boardCheck);
    await recordCheckTimeline(resolved.clinicianId, boardCheck, context.dryRun);

    const deaSnapshot = buildDeaSnapshot(credentials);
    const deaCheck = buildCheck({
      id: 'dea',
      title: 'DEA registration',
      status: deaSnapshot ? 'pass' : 'fail',
      summary: deaSnapshot
        ? `DEA registration ${deaSnapshot.registrationNumber} valid.`
        : 'No active DEA registration credential found.',
      evidence: deaSnapshot,
      timelineEvent: CredentialTimelineEventType.DEA_VERIFIED,
      timelineSeverity: deaSnapshot ? TimelineEventSeverity.INFO : TimelineEventSeverity.CRITICAL,
    });
    checks.push(deaCheck);
    await recordCheckTimeline(resolved.clinicianId, deaCheck, context.dryRun);

    const pecosSummary = summarizePecosStatus(pecosProviders);
    const pecosCheck = buildCheck({
      id: 'pecos',
      title: 'PECOS enrollment alignment',
      status: pecosSummary.status,
      summary: pecosSummary.notes,
      evidence: { provider: pecosProviders[0] },
      timelineEvent: CredentialTimelineEventType.PECOS_VERIFIED,
    });
    checks.push(pecosCheck);
    await recordCheckTimeline(resolved.clinicianId, pecosCheck, context.dryRun);

    if (pecosSummary.needsRevalidation) {
      recommendations.push({
        id: 'pecos-revalidation',
        label: 'Launch PECOS revalidation',
        detail: 'PECOS enrollment is due for revalidation.',
        type: 'task',
      });
    }

    const caqhSnapshot = buildCaqhSnapshot(resolved.caqhProfile);
    const payerChecks: RoutineCheckResult[] = [];

    for (const enrollment of resolved.payerEnrollments) {
      const eligibility = evaluatePayerEligibility(
        {
          clinicianId: resolved.clinicianId,
          payerId: enrollment.payerId,
          specialty: resolved.specialty,
          caqh: caqhSnapshot,
          boardCertification: boardSnapshot,
          dea: deaSnapshot,
          pecos: pecosSummary.status === 'fail' ? undefined : { status: 'APPROVED' },
          medicaid: enrollment.payer.planTypes.includes('Medicaid')
            ? {
                state: enrollment.payer.states[0] ?? resolved.state,
                status:
                  enrollment.status === 'ENROLLED'
                    ? 'ACTIVE'
                    : enrollment.status === 'REJECTED'
                    ? 'SUSPENDED'
                    : 'PENDING',
              }
            : undefined,
        },
        {
          requiresBoardCertification: true,
        },
      );

      payerChecks.push(
        buildCheck({
          id: `payer-${enrollment.id}`,
          title: `Payer ${enrollment.payer.name}`,
          status:
            eligibility.overallStatus === 'PASS'
              ? 'pass'
              : eligibility.overallStatus === 'WARNING'
              ? 'warning'
              : 'fail',
          summary: eligibility.blockers[0] ?? eligibility.warnings[0] ?? 'All checks passed.',
          evidence: {
            payerId: enrollment.payerId,
            status: enrollment.status,
            eligibility,
          },
          metadata: {
            action:
              eligibility.overallStatus === 'PASS'
                ? undefined
                : `Resolve ${eligibility.results
                    .filter(result => result.status !== 'PASS')
                    .map(result => result.ruleId)
                    .join(', ')} blockers`,
          },
        }),
      );

      const discrepancies = detectPayerDiscrepancies({
        clinicianId: resolved.clinicianId,
        clinicianSpecialty: resolved.specialty,
        payer: {
          id: enrollment.payer.id,
          name: enrollment.payer.name,
          requiresCaqh: enrollment.payer.requiresCaqh,
          specialty: enrollment.payer.specialty,
          states: enrollment.payer.states,
        },
        enrollment,
        caqh: resolved.caqhProfile
          ? {
              hasProfile: true,
            }
          : {
              hasProfile: false,
            },
      });

      discrepancies.forEach(discrepancy => {
        payerChecks.push(
          buildCheck({
            id: `payer-${enrollment.id}-${discrepancy.code}`,
            title: `${enrollment.payer.name} discrepancy`,
            status: discrepancy.severity === 'critical' ? 'fail' : 'warning',
            summary: discrepancy.message,
            evidence: discrepancy.context,
            metadata: {
              action: discrepancy.recommendation,
            },
          }),
        );
      });
    }

    checks.push(...payerChecks);
    recommendations.push(...collectPayerRecommendations(payerChecks));

    const completedAt = new Date();
    const summary = `${checks.filter(check => check.status === 'fail').length} fail / ${
      checks.filter(check => check.status === 'warning').length
    } warn / ${checks.filter(check => check.status === 'pass').length} pass`;

    return {
      routineId: 'auto-psv',
      clinicianId: resolved.clinicianId,
      clinicianDid: resolved.clinicianDid,
      npi: resolved.npi,
      startedAt,
      completedAt,
      status: 'completed',
      summary,
      checks,
      recommendations,
    };
  } catch (error) {
    logger.error('[autoPSV] routine failed', error);
    return {
      routineId: 'auto-psv',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto PSV routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}
