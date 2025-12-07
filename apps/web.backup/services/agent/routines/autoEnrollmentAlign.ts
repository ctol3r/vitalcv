import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import {
  evaluatePayerEligibility,
  type CaqhSnapshot,
  type MedicaidSnapshot,
  type PecosSnapshot,
} from '../../payer/eligibilityEngine';
import { detectPayerDiscrepancies } from '../../payer/detectPayerDiscrepancies';
import {
  buildPayerNetworkGraph,
  type GraphEnrollmentSnapshot,
} from '../../payer/networkGraph';
import {
  resolveClinicianContext,
  fetchPecosProviders,
  buildCheck,
  emitTimelineEvent,
  upsertRevalidationTask,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const PECOS_APPROVED_STATUSES = new Set(['APPROVED', 'ENROLLED', 'ACTIVE']);

function buildCaqhSnapshot(profile?: any): CaqhSnapshot | undefined {
  if (!profile) return undefined;
  const fields = (profile.fields as Record<string, unknown> | null) ?? {};
  const completeness =
    typeof fields.completeness === 'number'
      ? Math.min(1, Math.max(0, fields.completeness))
      : 0.8;
  return {
    completeness,
    attestedAt: (fields.attestedAt as string | undefined) ?? profile.lastSyncedAt?.toISOString(),
    missingSections: Array.isArray(fields.missingSections)
      ? (fields.missingSections as string[])
      : undefined,
  };
}

function summarizePecos(
  providers: Awaited<ReturnType<typeof fetchPecosProviders>>,
): { snapshot: PecosSnapshot | undefined; needsRevalidation: boolean; status: RoutineCheckResult['status']; notes: string } {
  if (!providers.length) {
    return {
      snapshot: undefined,
      needsRevalidation: true,
      status: 'warning',
      notes: 'No PECOS provider record found.',
    };
  }

  const provider = providers[0];
  const approved = PECOS_APPROVED_STATUSES.has(provider.status);
  const needsRevalidation =
    !!provider.revalidationDate && provider.revalidationDate.getTime() < Date.now();

  return {
    snapshot: {
      status: approved ? 'APPROVED' : 'PENDING',
      effectiveDate: provider.effectiveDate ?? undefined,
      revalidationDueDate: provider.revalidationDate ?? undefined,
    },
    needsRevalidation,
    status: approved ? (needsRevalidation ? 'warning' : 'pass') : 'fail',
    notes: approved ? 'PECOS enrollment active.' : `PECOS status ${provider.status}.`,
  };
}

type ResolvedEnrollment = ReturnType<typeof mapEnrollment>[number];

function mapEnrollment(enrollments: any[]): ResolvedEnrollment[] {
  return enrollments.map(enrollment => ({
    id: enrollment.id,
    clinicianId: enrollment.clinicianId,
    payerId: enrollment.payerId,
    status: enrollment.status,
    effectiveDate: enrollment.effectiveDate,
    panelType: enrollment.panelType,
    notes: enrollment.notes,
    metadata: enrollment.metadata,
    lastStatusChange: enrollment.lastStatusChange,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    payer: enrollment.payer,
  }));
}

function medicaidSnapshot(enrollment: ResolvedEnrollment): MedicaidSnapshot {
  return {
    state: enrollment.payer.states[0] ?? 'NA',
    status:
      enrollment.status === 'ENROLLED'
        ? 'ACTIVE'
        : enrollment.status === 'REJECTED'
        ? 'SUSPENDED'
        : 'PENDING',
  };
}

function toGraphSnapshots(
  enrollments: ResolvedEnrollment[],
): GraphEnrollmentSnapshot[] {
  return enrollments.map(enrollment => ({
    enrollment: {
      id: enrollment.id,
      clinicianId: enrollment.clinicianId,
      payerId: enrollment.payerId,
      status: enrollment.status as any,
      effectiveDate: enrollment.effectiveDate,
      panelType: enrollment.panelType as any,
      notes: enrollment.notes,
      metadata: enrollment.metadata ?? undefined,
      lastStatusChange: enrollment.lastStatusChange,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    },
    payer: enrollment.payer,
  }));
}

export async function runAutoEnrollmentAlignRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    const enrollments = mapEnrollment(resolved.payerEnrollments);

    const [pecosProviders] = await Promise.all([
      fetchPecosProviders(resolved.clinicianId),
    ]);

    const caqh = buildCaqhSnapshot(resolved.caqhProfile);
    const pecosSummary = summarizePecos(pecosProviders);

    const medicaidEnrollments = enrollments.filter(enrollment =>
      enrollment.payer.planTypes.some(plan => plan.toLowerCase().includes('medicaid')),
    );

    const medicaidMisaligned = medicaidEnrollments.filter(enrollment => {
      const medicaid = medicaidSnapshot(enrollment);
      return (
        medicaid.status === 'ACTIVE' &&
        (!pecosSummary.snapshot || pecosSummary.snapshot.status !== 'APPROVED')
      );
    });

    const medicaidCheck = buildCheck({
      id: 'medicaid-alignment',
      title: 'Medicaid vs PECOS alignment',
      status: medicaidMisaligned.length ? 'fail' : medicaidEnrollments.length ? 'pass' : 'warning',
      summary: medicaidMisaligned.length
        ? `Medicaid active in ${medicaidMisaligned.length} state(s) without PECOS approval.`
        : medicaidEnrollments.length
        ? 'Medicaid enrollments aligned with PECOS.'
        : 'No Medicaid enrollments on file.',
      evidence: {
        medicaidStates: medicaidEnrollments.map(enrollment => enrollment.payer.states[0]),
      },
      timelineEvent: medicaidMisaligned.length
        ? CredentialTimelineEventType.DISCREPANCY_FOUND
        : undefined,
      timelineSeverity: medicaidMisaligned.length ? TimelineEventSeverity.CRITICAL : undefined,
    });
    checks.push(medicaidCheck);

    if (medicaidMisaligned.length) {
      await emitTimelineEvent({
        clinicianId: resolved.clinicianId,
        eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
        severity: TimelineEventSeverity.CRITICAL,
        metadata: { medicaidMisaligned },
        dryRun: context.dryRun,
      });

      recommendations.push({
        id: 'medicaid-pecos',
        label: 'Align Medicaid with PECOS',
        detail: 'Active Medicaid enrollments require matching PECOS approval.',
        type: 'task',
      });

      await upsertRevalidationTask({
        clinicianId: resolved.clinicianId,
        type: 'MEDICAID',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: 'Resolve Medicaid/PECOS alignment discrepancy.',
        metadata: { medicaidMisaligned },
        dryRun: context.dryRun,
      });
    }

    const pecosCheck = buildCheck({
      id: 'pecos-status',
      title: 'PECOS enrollment status',
      status: pecosSummary.status,
      summary: pecosSummary.notes,
      evidence: pecosSummary.snapshot ?? { provider: pecosProviders[0] },
      timelineEvent: CredentialTimelineEventType.PECOS_VERIFIED,
    });
    checks.push(pecosCheck);

    if (pecosSummary.needsRevalidation) {
      recommendations.push({
        id: 'pecos-revalidation',
        label: 'Start PECOS revalidation',
        detail: 'PECOS enrollment nearing expiration.',
        type: 'task',
      });
      await upsertRevalidationTask({
        clinicianId: resolved.clinicianId,
        type: 'PECOS',
        dueDate: pecosSummary.snapshot?.revalidationDueDate ?? new Date(),
        notes: 'PECOS revalidation required.',
        dryRun: context.dryRun,
      });
    }

    const payerDiscrepancies: RoutineCheckResult[] = [];
    for (const enrollment of enrollments) {
      const eligibility = evaluatePayerEligibility(
        {
          clinicianId: resolved.clinicianId,
          payerId: enrollment.payerId,
          specialty: resolved.specialty,
          caqh,
          medicaid: enrollment.payer.planTypes.includes('Medicaid')
            ? medicaidSnapshot(enrollment)
            : undefined,
          pecos: pecosSummary.snapshot,
        },
        {},
      );

      if (eligibility.overallStatus !== 'PASS') {
        payerDiscrepancies.push(
          buildCheck({
            id: `eligibility-${enrollment.id}`,
            title: `Payer ${enrollment.payer.name} eligibility`,
            status: eligibility.overallStatus === 'FAIL' ? 'fail' : 'warning',
            summary: eligibility.blockers[0] ?? eligibility.warnings[0] ?? 'Needs review.',
            evidence: eligibility,
            metadata: {
              action: eligibility.blockers[0] ?? eligibility.warnings[0],
            },
          }),
        );
      }

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
        caqh: caqh
          ? {
              hasProfile: true,
              completeness: caqh.completeness,
            }
          : {
              hasProfile: false,
            },
      });

      discrepancies.forEach(discrepancy => {
        payerDiscrepancies.push(
          buildCheck({
            id: `discrepancy-${enrollment.id}-${discrepancy.code}`,
            title: `${enrollment.payer.name} discrepancy`,
            status: discrepancy.severity === 'critical' ? 'fail' : 'warning',
            summary: discrepancy.message,
            evidence: discrepancy.context,
            metadata: { action: discrepancy.recommendation },
          }),
        );
      });
    }

    checks.push(...payerDiscrepancies);
    recommendations.push(
      ...payerDiscrepancies
        .filter(check => check.metadata?.action)
        .map(check => ({
          id: `action-${check.id}`,
          label: String(check.metadata?.action),
          detail: check.summary,
          type: 'task',
        })),
    );

    const graph = buildPayerNetworkGraph({
      clinicianId: resolved.clinicianId,
      enrollments: toGraphSnapshots(enrollments),
      practiceStates: [resolved.state],
    });

    if (graph.coverageGaps.length) {
      const coverageCheck = buildCheck({
        id: 'coverage-gaps',
        title: 'Payer coverage gaps',
        status: 'warning',
        summary: graph.coverageGaps
          .map(gap => `${gap.state}: missing ${gap.missingPayers.join(', ')}`)
          .join('; '),
        evidence: { coverageGaps: graph.coverageGaps },
      });
      checks.push(coverageCheck);
      recommendations.push(
        ...graph.coverageGaps.map(gap => ({
          id: `gap-${gap.state}`,
          label: `Target payers for ${gap.state}`,
          detail: `Missing ${gap.missingPayers.join(', ')}.`,
          type: 'task',
        })),
      );
    }

    const summary = `${checks.filter(check => check.status === 'fail').length} fail, ${
      checks.filter(check => check.status === 'warning').length
    } warn`;
    return {
      routineId: 'auto-enrollment-align',
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
    return {
      routineId: 'auto-enrollment-align',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto enrollment alignment routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}

import { CredentialTimelineEventType, TimelineEventSeverity } from '@prisma/client';
import {
  evaluatePayerEligibility,
  type CaqhSnapshot,
  type MedicaidSnapshot,
  type PecosSnapshot,
} from '../../payer/eligibilityEngine';
import { detectPayerDiscrepancies } from '../../payer/detectPayerDiscrepancies';
import {
  buildPayerNetworkGraph,
  type GraphEnrollmentSnapshot,
} from '../../payer/networkGraph';
import {
  resolveClinicianContext,
  fetchPecosProviders,
  buildCheck,
  emitTimelineEvent,
  upsertRevalidationTask,
} from './shared';
import type {
  AgentRoutineContext,
  AgentRoutineResult,
  RoutineActionRecommendation,
  RoutineCheckResult,
} from './types';

const PECOS_APPROVED_STATUSES = new Set(['APPROVED', 'ENROLLED', 'ACTIVE']);

function buildCaqhSnapshot(profile?: any): CaqhSnapshot | undefined {
  if (!profile) return undefined;
  const fields = (profile.fields as Record<string, unknown> | null) ?? {};
  const completeness =
    typeof fields.completeness === 'number'
      ? Math.min(1, Math.max(0, fields.completeness))
      : 0.8;
  return {
    completeness,
    attestedAt: (fields.attestedAt as string | undefined) ?? profile.lastSyncedAt?.toISOString(),
    missingSections: Array.isArray(fields.missingSections)
      ? (fields.missingSections as string[])
      : undefined,
  };
}

function summarizePecos(
  providers: Awaited<ReturnType<typeof fetchPecosProviders>>,
): { snapshot: PecosSnapshot | undefined; needsRevalidation: boolean; status: RoutineCheckResult['status']; notes: string } {
  if (!providers.length) {
    return {
      snapshot: undefined,
      needsRevalidation: true,
      status: 'warning',
      notes: 'No PECOS provider record found.',
    };
  }

  const provider = providers[0];
  const approved = PECOS_APPROVED_STATUSES.has(provider.status);
  const needsRevalidation =
    !!provider.revalidationDate && provider.revalidationDate.getTime() < Date.now();

  return {
    snapshot: {
      status: approved ? 'APPROVED' : 'PENDING',
      effectiveDate: provider.effectiveDate ?? undefined,
      revalidationDueDate: provider.revalidationDate ?? undefined,
    },
    needsRevalidation,
    status: approved ? (needsRevalidation ? 'warning' : 'pass') : 'fail',
    notes: approved ? 'PECOS enrollment active.' : `PECOS status ${provider.status}.`,
  };
}

function toGraphSnapshots(
  enrollments: ResolvedEnrollment[],
): GraphEnrollmentSnapshot[] {
  return enrollments.map(enrollment => ({
    enrollment: {
      id: enrollment.id,
      clinicianId: enrollment.clinicianId,
      payerId: enrollment.payerId,
      status: enrollment.status as any,
      effectiveDate: enrollment.effectiveDate,
      panelType: enrollment.panelType as any,
      notes: enrollment.notes,
      metadata: enrollment.metadata ?? undefined,
      lastStatusChange: enrollment.lastStatusChange,
      createdAt: enrollment.createdAt,
      updatedAt: enrollment.updatedAt,
    },
    payer: enrollment.payer,
  }));
}

type ResolvedEnrollment = ReturnType<typeof mapEnrollment>[number];

function mapEnrollment(enrollments: any[]): ResolvedEnrollment[] {
  return enrollments.map(enrollment => ({
    id: enrollment.id,
    clinicianId: enrollment.clinicianId,
    payerId: enrollment.payerId,
    status: enrollment.status,
    effectiveDate: enrollment.effectiveDate,
    panelType: enrollment.panelType,
    notes: enrollment.notes,
    metadata: enrollment.metadata,
    lastStatusChange: enrollment.lastStatusChange,
    createdAt: enrollment.createdAt,
    updatedAt: enrollment.updatedAt,
    payer: enrollment.payer,
  }));
}

function medicaidSnapshot(enrollment: ResolvedEnrollment): MedicaidSnapshot {
  return {
    state: enrollment.payer.states[0] ?? 'NA',
    status:
      enrollment.status === 'ENROLLED'
        ? 'ACTIVE'
        : enrollment.status === 'REJECTED'
        ? 'SUSPENDED'
        : 'PENDING',
  };
}

export async function runAutoEnrollmentAlignRoutine(
  context: AgentRoutineContext,
): Promise<AgentRoutineResult> {
  const startedAt = new Date();
  const checks: RoutineCheckResult[] = [];
  const recommendations: RoutineActionRecommendation[] = [];

  try {
    const resolved = await resolveClinicianContext(context);
    const enrollments = mapEnrollment(resolved.payerEnrollments);

    const [pecosProviders] = await Promise.all([
      fetchPecosProviders(resolved.clinicianId),
    ]);

    const caqh = buildCaqhSnapshot(resolved.caqhProfile);
    const pecosSummary = summarizePecos(pecosProviders);

    const medicaidEnrollments = enrollments.filter(enrollment =>
      enrollment.payer.planTypes.some(plan => plan.toLowerCase().includes('medicaid')),
    );

    const medicaidMisaligned = medicaidEnrollments.filter(enrollment => {
      const medicaid = medicaidSnapshot(enrollment);
      return (
        medicaid.status === 'ACTIVE' &&
        (!pecosSummary.snapshot || pecosSummary.snapshot.status !== 'APPROVED')
      );
    });

    const medicaidCheck = buildCheck({
      id: 'medicaid-alignment',
      title: 'Medicaid vs PECOS alignment',
      status: medicaidMisaligned.length ? 'fail' : medicaidEnrollments.length ? 'pass' : 'warning',
      summary: medicaidMisaligned.length
        ? `Medicaid active in ${medicaidMisaligned.length} state(s) without PECOS approval.`
        : medicaidEnrollments.length
        ? 'Medicaid enrollments aligned with PECOS.'
        : 'No Medicaid enrollments on file.',
      evidence: {
        medicaidStates: medicaidEnrollments.map(enrollment => enrollment.payer.states[0]),
      },
      timelineEvent: medicaidMisaligned.length
        ? CredentialTimelineEventType.DISCREPANCY_FOUND
        : undefined,
      timelineSeverity: medicaidMisaligned.length ? TimelineEventSeverity.CRITICAL : undefined,
    });
    checks.push(medicaidCheck);

    if (medicaidMisaligned.length) {
      await emitTimelineEvent({
        clinicianId: resolved.clinicianId,
        eventType: CredentialTimelineEventType.DISCREPANCY_FOUND,
        severity: TimelineEventSeverity.CRITICAL,
        metadata: { medicaidMisaligned },
        dryRun: context.dryRun,
      });

      recommendations.push({
        id: 'medicaid-pecos',
        label: 'Align Medicaid with PECOS',
        detail: 'Active Medicaid enrollments require matching PECOS approval.',
        type: 'task',
      });

      await upsertRevalidationTask({
        clinicianId: resolved.clinicianId,
        type: 'MEDICAID',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        notes: 'Resolve Medicaid/PECOS alignment discrepancy.',
        metadata: { medicaidMisaligned },
        dryRun: context.dryRun,
      });
    }

    const pecosCheck = buildCheck({
      id: 'pecos-status',
      title: 'PECOS enrollment status',
      status: pecosSummary.status,
      summary: pecosSummary.notes,
      evidence: pecosSummary.snapshot ?? { provider: pecosProviders[0] },
      timelineEvent: CredentialTimelineEventType.PECOS_VERIFIED,
    });
    checks.push(pecosCheck);

    if (pecosSummary.needsRevalidation) {
      recommendations.push({
        id: 'pecos-revalidation',
        label: 'Start PECOS revalidation',
        detail: 'PECOS enrollment nearing expiration.',
        type: 'task',
      });
      await upsertRevalidationTask({
        clinicianId: resolved.clinicianId,
        type: 'PECOS',
        dueDate: pecosSummary.snapshot?.revalidationDueDate ?? new Date(),
        notes: 'PECOS revalidation required.',
        dryRun: context.dryRun,
      });
    }

    const payerDiscrepancies: RoutineCheckResult[] = [];
    for (const enrollment of enrollments) {
      const eligibility = evaluatePayerEligibility(
        {
          clinicianId: resolved.clinicianId,
          payerId: enrollment.payerId,
          specialty: resolved.specialty,
          caqh,
          medicaid: enrollment.payer.planTypes.includes('Medicaid')
            ? medicaidSnapshot(enrollment)
            : undefined,
          pecos: pecosSummary.snapshot,
        },
        {},
      );

      if (eligibility.overallStatus !== 'PASS') {
        payerDiscrepancies.push(
          buildCheck({
            id: `eligibility-${enrollment.id}`,
            title: `Payer ${enrollment.payer.name} eligibility`,
            status: eligibility.overallStatus === 'FAIL' ? 'fail' : 'warning',
            summary: eligibility.blockers[0] ?? eligibility.warnings[0] ?? 'Needs review.',
            evidence: eligibility,
            metadata: {
              action: eligibility.blockers[0] ?? eligibility.warnings[0],
            },
          }),
        );
      }

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
        caqh: caqh
          ? {
              hasProfile: true,
              completeness: caqh.completeness,
            }
          : {
              hasProfile: false,
            },
      });

      discrepancies.forEach(discrepancy => {
        payerDiscrepancies.push(
          buildCheck({
            id: `discrepancy-${enrollment.id}-${discrepancy.code}`,
            title: `${enrollment.payer.name} discrepancy`,
            status: discrepancy.severity === 'critical' ? 'fail' : 'warning',
            summary: discrepancy.message,
            evidence: discrepancy.context,
            metadata: { action: discrepancy.recommendation },
          }),
        );
      });
    }

    checks.push(...payerDiscrepancies);
    recommendations.push(
      ...payerDiscrepancies
        .filter(check => check.metadata?.action)
        .map(check => ({
          id: `action-${check.id}`,
          label: String(check.metadata?.action),
          detail: check.summary,
          type: 'task',
        })),
    );

    const graph = buildPayerNetworkGraph({
      clinicianId: resolved.clinicianId,
      enrollments: toGraphSnapshots(enrollments),
      practiceStates: [resolved.state],
    });

    if (graph.coverageGaps.length) {
      const coverageCheck = buildCheck({
        id: 'coverage-gaps',
        title: 'Payer coverage gaps',
        status: 'warning',
        summary: graph.coverageGaps
          .map(gap => `${gap.state}: missing ${gap.missingPayers.join(', ')}`)
          .join('; '),
        evidence: { coverageGaps: graph.coverageGaps },
      });
      checks.push(coverageCheck);
      recommendations.push(
        ...graph.coverageGaps.map(gap => ({
          id: `gap-${gap.state}`,
          label: `Target payers for ${gap.state}`,
          detail: `Missing ${gap.missingPayers.join(', ')}.`,
          type: 'task',
        })),
      );
    }

    const summary = `${checks.filter(check => check.status === 'fail').length} fail, ${
      checks.filter(check => check.status === 'warning').length
    } warn`;
    return {
      routineId: 'auto-enrollment-align',
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
    return {
      routineId: 'auto-enrollment-align',
      startedAt,
      completedAt: new Date(),
      status: 'failed',
      summary: 'Auto enrollment alignment routine failed',
      error: error instanceof Error ? error.message : 'Unexpected error',
      checks,
      recommendations,
    };
  }
}


