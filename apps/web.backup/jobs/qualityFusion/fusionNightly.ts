import { PrismaClient } from '@prisma/client';
import {
  loadBaselineRiskData,
  runBaselineRules,
  BaselineRiskData,
} from '../../services/credentialRisk/baselineEngine';
import {
  evaluateQualityCredentialFusion,
} from '../../services/qualityFusion/fusionEngine';
import {
  projectFusionResult,
  upsertQualityCredentialFusion,
} from '../../services/qualityFusion/models/QualityCredentialFusion';
import {
  ComplianceFindingInput,
  FusionSignalInput,
  QualitySignalType,
  CredentialSignalType,
} from '../../services/qualityFusion/types';

const prisma = new PrismaClient();

export type FusionTrigger =
  | 'oppe'
  | 'fppe'
  | 'compliance'
  | 'drift'
  | 'enrollment'
  | 'privilege';

export interface FusionTriggerEvent {
  type: FusionTrigger;
  clinicianId?: string;
  clinicianDid?: string;
  payload?: Record<string, unknown>;
}

export interface QualityFusionJobOptions {
  clinicianIds?: string[];
  events?: FusionTriggerEvent[];
  asOf?: Date;
  lookbackHours?: number;
  dryRun?: boolean;
  client?: PrismaClient;
}

export interface QualityFusionJobStats {
  processed: number;
  updated: number;
  skipped: number;
  errors: string[];
  startedAt: Date;
  finishedAt: Date;
  impactedClinicians: string[];
}

const OPEN_TASK_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'OVERDUE']);
const NEGATIVE_PECOS_STATUSES = new Set(['REJECTED', 'DEACTIVATED', 'TERMINATED']);
const NEGATIVE_LICENSE_STATUSES = new Set(['EXPIRED', 'SUSPENDED', 'REVOKED', 'INACTIVE']);

export async function runQualityFusionJob(
  options: QualityFusionJobOptions = {}
): Promise<QualityFusionJobStats> {
  const client = options.client ?? prisma;
  const asOf = options.asOf ?? new Date();
  const startedAt = new Date();

  const impacted = await collectImpactedClinicians(options, client);
  const stats: QualityFusionJobStats = {
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    startedAt,
    finishedAt: startedAt,
    impactedClinicians: Array.from(impacted),
  };

  if (impacted.size === 0) {
    stats.finishedAt = new Date();
    return stats;
  }

  for (const clinicianId of impacted) {
    stats.processed += 1;
    try {
      const baselineData = await loadBaselineRiskData(clinicianId, client);
      const baselineResult = runBaselineRules(baselineData, asOf);

      const fusionResult = evaluateQualityCredentialFusion({
        clinicianId,
        qualitySignals: buildQualitySignalsFromBaseline(baselineData, asOf),
        credentialSignals: buildCredentialSignalsFromBaseline(baselineData),
        credentialRiskFactors: baselineResult.factors,
        complianceFindings: buildComplianceFindingsFromBaseline(baselineData),
        baselineRiskScore: baselineResult.score,
        asOf,
      });

      if (!options.dryRun) {
        await upsertQualityCredentialFusion(projectFusionResult(fusionResult), client as any);
      }
      stats.updated += 1;
    } catch (error) {
      stats.skipped += 1;
      const message =
        error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
      stats.errors.push(`[${clinicianId}] ${message}`);
      console.error('[QualityFusionJob] Failed', clinicianId, message);
    }
  }

  stats.finishedAt = new Date();
  return stats;
}

async function collectImpactedClinicians(
  options: QualityFusionJobOptions,
  client: PrismaClient
): Promise<Set<string>> {
  const impacted = new Set<string>(options.clinicianIds ?? []);
  options.events
    ?.map((event) => event.clinicianId)
    .filter((id): id is string => Boolean(id))
    .forEach((id) => impacted.add(id));

  if (impacted.size > 0) {
    return impacted;
  }

  // Nightly fallback: include anyone updated recently. If lookbackHours undefined, default 24h.
  const lookbackHours = options.lookbackHours ?? 24;
  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const [oppe, drift, pecos, privilege] = await Promise.all([
    client.oPPECase.findMany({
      where: { updatedAt: { gte: since } },
      select: { clinicianId: true },
    }),
    client.driftEvent.findMany({
      where: { updatedAt: { gte: since } },
      select: { clinicianId: true },
    }),
    client.pECOSProvider.findMany({
      where: { updatedAt: { gte: since } },
      select: { clinicianId: true },
    }),
    client.privilegeRequest.findMany({
      where: { updatedAt: { gte: since } },
      select: { clinicianId: true },
    }),
  ]);

  [...oppe, ...drift, ...pecos, ...privilege]
    .map((record) => record.clinicianId)
    .filter((id): id is string => Boolean(id))
    .forEach((id) => impacted.add(id));

  if (impacted.size === 0) {
    const clinicians = await client.clinicianProfile.findMany({
      select: { id: true },
    });
    clinicians.forEach((clinician) => impacted.add(clinician.id));
  }

  return impacted;
}

function buildQualitySignalsFromBaseline(
  data: BaselineRiskData,
  asOf: Date
): FusionSignalInput[] {
  const signals: FusionSignalInput[] = [];
  const failingOppe = data.oppeCases.some((oppe) => {
    const status = normalizeStatus(oppe.status);
    if (status === 'FAILED') return true;
    const metrics = oppe.metrics ?? {};
    const complications = Number(metrics?.complications ?? 0);
    const issues = Number(metrics?.issuesFlagged ?? 0);
    return complications >= 3 || issues >= 1;
  });

  if (failingOppe) {
    signals.push({
      type: QualitySignalType.OPPE_FAILURE,
      label: 'OPPE failure',
      severity: 'HIGH',
      occurredAt: asOf,
      recommendedActions: ['Assign targeted FPPE observer'],
    });
  }

  const complicationSpike = data.oppeCases.some((oppe) => {
    const metrics = oppe.metrics ?? {};
    const complications = Number(metrics?.complications ?? 0);
    return complications >= 5;
  });
  if (complicationSpike) {
    signals.push({
      type: QualitySignalType.COMPLICATION_SPIKE,
      label: 'Complication spike',
      severity: 'CRITICAL',
      description: 'OPPE metrics show >=5 complications in recent cases.',
      occurredAt: asOf,
    });
  }

  const fppeStatus = normalizeStatus(data.fppeSummary?.fppeStatus);
  if (fppeStatus === 'FAILED' || fppeStatus === 'IN_PROGRESS') {
    signals.push({
      type: QualitySignalType.FPPE_ESCALATION,
      label: 'FPPE escalation',
      severity: fppeStatus === 'FAILED' ? 'HIGH' : 'MODERATE',
      occurredAt: data.fppeSummary?.fppeEndDate ?? asOf,
      description: 'FPPE remains open past due or failed evaluation.',
    });
  }

  if (normalizeStatus(data.fppeSummary?.oppeStatus) === 'HOLD') {
    signals.push({
      type: QualitySignalType.QUALITY_HOLD,
      label: 'Quality hold',
      severity: 'MODERATE',
      description: 'OPPE summary indicates hold status.',
      occurredAt: data.fppeSummary?.oppeNextReviewDue ?? asOf,
    });
  }

  const denialTasks = data.revalidationTasks.filter(
    (task) => normalizeStatus(task.category) === 'PAYER_DENIAL'
  );
  if (denialTasks.length >= 2) {
    const metadata = (denialTasks[0]?.metadata as Record<string, unknown> | null) ?? null;
    const openedAt = typeof metadata?.openedAt === 'string' ? metadata.openedAt : undefined;
    signals.push({
      type: QualitySignalType.PAYER_DENIAL_SPIKE,
      label: 'Payer denial spike',
      severity: 'HIGH',
      description: 'Multiple payer denial remediation tasks opened.',
      occurredAt: openedAt,
    });
  }

  return signals;
}

function buildCredentialSignalsFromBaseline(
  data: BaselineRiskData
): FusionSignalInput[] {
  const signals: FusionSignalInput[] = [];

  const boardDrift = data.boardCredentials.some((credential) => {
    const status = normalizeStatus(credential.status);
    return status === 'LAPSED' || status === 'INACTIVE';
  });
  if (boardDrift) {
    signals.push({
      type: CredentialSignalType.BOARD_STATUS_DRIFT,
      label: 'Board drift detected',
      severity: 'MODERATE',
      description: 'Board credential inactive or lapsed.',
    });
  }

  const licenseDrift = data.licenses.some((license) => {
    const status = normalizeStatus(license.status);
    if (NEGATIVE_LICENSE_STATUSES.has(status)) return true;
    const expiry = license.expiryDate ? new Date(license.expiryDate) : null;
    return expiry ? expiry < new Date() : false;
  });
  if (licenseDrift) {
    signals.push({
      type: CredentialSignalType.LICENSE_DRIFT,
      label: 'License drift detected',
      severity: 'HIGH',
      description: 'Active license issue found during nightly review.',
    });
  }

  const pecosConflict = data.pecosEnrollments.some((enrollment) =>
    NEGATIVE_PECOS_STATUSES.has(normalizeStatus(enrollment.status))
  );
  if (pecosConflict) {
    signals.push({
      type: CredentialSignalType.PECOS_CONFLICT,
      label: 'PECOS conflict',
      severity: 'HIGH',
      description: 'PECOS enrollment rejected or deactivated.',
    });
  }

  const privilegeGap = data.revalidationTasks.some(
    (task) => normalizeStatus(task.category) === 'PRIVILEGE'
  );
  if (privilegeGap) {
    signals.push({
      type: CredentialSignalType.PRIVILEGE_GAP,
      label: 'Privilege remediation gap',
      severity: 'MODERATE',
      description: 'Open privilege remediation or document request detected.',
    });
  }

  return signals;
}

function buildComplianceFindingsFromBaseline(
  data: BaselineRiskData
): ComplianceFindingInput[] {
  const tasks = data.revalidationTasks ?? [];
  return tasks
    .filter((task) => OPEN_TASK_STATUSES.has(normalizeStatus(task.status)))
    .map((task, index) => {
      const metadata = (task.metadata as Record<string, unknown> | null) ?? null;
      const openedAt =
        typeof metadata?.openedAt === 'string' ? (metadata.openedAt as string) : undefined;
      return {
        id: `compliance_${index}`,
        label: task.category ?? 'Compliance Task',
        severity: normalizeStatus(task.category).includes('FAIL') ? 'CRITICAL' : 'MODERATE',
        description: `Open remediation task (${task.category ?? 'GENERAL'})`,
        occurredAt: openedAt,
      };
    });
}

function normalizeStatus(value?: string | null): string {
  return (value ?? '').toUpperCase();
}


