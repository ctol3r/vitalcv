import {
  PrismaClient,
  type ContinuousCheck,
  type CustodyRecord,
  type OnboardingKinetics as OnboardingKineticsRecord,
} from '@prisma/client';
import { anchorOnboardingKineticsSnapshot } from '../audit/anchor';

const prisma = new PrismaClient();
const ONE_DAY_MS = 86_400_000;

export const ONBOARDING_PHASES = ['docs', 'verification', 'committee', 'itAccess', 'onboarding'] as const;
export type OnboardingPhase = (typeof ONBOARDING_PHASES)[number];
export type BottleneckType = 'missingDocuments' | 'expiredLicenses' | 'unverifiedNpdb';

export interface SimulationInput {
  clinicianId: string;
  orgId?: string;
  startDate?: Date;
  referenceDate?: Date;
}

export interface PhaseProjection {
  phase: OnboardingPhase;
  durationDays: number;
  startDate: string;
  projectedCompletion: string;
  confidence: number;
  bottleneckRisk: Record<BottleneckType, number>;
}

export interface BottleneckPrediction {
  type: BottleneckType;
  severity: 'low' | 'moderate' | 'high';
  confidence: number;
  signals: string[];
  recommendedActions: string[];
}

export interface AutoExpediteSuggestion {
  type: 'licenseRenewal' | 'boardCertUpdate' | 'compactEnrollment';
  impactScore: number;
  rationale: string;
  recommendedAction: string;
  blocking: boolean;
}

export interface OnboardingVelocityModel {
  projectedCompletionDate: string;
  projectedDays: number;
  currentPhase: OnboardingPhase;
  progressPercent: number;
  etaConfidence: number;
}

export interface EfficiencyScoreBreakdown {
  overall: number;
  readiness: number;
  documentQuality: number;
  automation: number;
  penalty: number;
}

export interface OnboardingExportRow {
  clinicianId: string;
  orgId?: string;
  phase: OnboardingPhase;
  durationDays: number;
  startDate: string;
  projectedCompletion: string;
  bottleneckPressure: number;
  efficiencyScore: number;
  readinessScore: number;
}

export interface OnboardingSimulationResult {
  clinicianId: string;
  orgId?: string;
  phases: PhaseProjection[];
  velocity: OnboardingVelocityModel;
  bottlenecks: BottleneckPrediction[];
  expediteSuggestions: AutoExpediteSuggestion[];
  efficiency: EfficiencyScoreBreakdown;
  exportPayload: {
    rows: OnboardingExportRow[];
    csv: string;
  };
}

interface DocumentStats {
  uploads: number;
  verified: number;
  anchored: number;
  lastActionAt?: string | null;
  coverageRatio: number;
  missingDocumentsScore: number;
  automationCoverage: number;
  freshnessDays: number;
  quality: number;
}

interface PhaseProjectionContext {
  startDate: Date;
  docStats: DocumentStats;
  readinessScore: number;
  licenseCheck?: ContinuousCheck;
  npdbCheck?: ContinuousCheck;
}

interface EfficiencyContext {
  readinessScore: number;
  docQuality: number;
  automationCoverage: number;
  bottleneckSeverity: number;
}

export interface HeatmapCell {
  phase: OnboardingPhase;
  avgDuration: number;
  medianDuration: number;
  sampleSize: number;
  bottleneckPressure: number;
  severity: 'stable' | 'warning' | 'critical';
}

export interface HeatmapSummary {
  cells: HeatmapCell[];
  topBottlenecks: {
    type: BottleneckType;
    frequency: number;
    severity: 'low' | 'moderate' | 'high';
    sampleSize: number;
  }[];
  readinessBands: { label: string; count: number }[];
  clinicianTotals: number;
}

export interface AggregatedExportRow {
  clinicianId: string;
  docsDuration: number;
  verificationDuration: number;
  committeeDuration: number;
  itAccessDuration: number;
  onboardingDuration: number;
  totalDuration: number;
  lastUpdated: string;
  riskiestPhase: OnboardingPhase;
  dominantBottleneck: BottleneckType | null;
}

const BASE_PHASE_DURATIONS: Record<OnboardingPhase, number> = {
  docs: 5.5,
  verification: 11.5,
  committee: 7,
  itAccess: 4,
  onboarding: 3,
};

export async function runOnboardingSimulationV3(
  input: SimulationInput,
): Promise<OnboardingSimulationResult> {
  if (!input.clinicianId) {
    throw new Error('clinician_id_required');
  }

  const referenceDate = input.referenceDate ?? new Date();
  const startDate = input.startDate ?? referenceDate;

  const [readiness, custodyRecords, checks] = await Promise.all([
    prisma.clinicianReadinessScore.findUnique({ where: { clinicianId: input.clinicianId } }),
    prisma.custodyRecord.findMany({
      where: { clinicianId: input.clinicianId },
      orderBy: { timestamp: 'desc' },
      take: 250,
    }),
    prisma.continuousCheck.findMany({
      where: { clinicianId: input.clinicianId },
      orderBy: { runAt: 'desc' },
      take: 60,
    }),
  ]);

  const docStats = analyzeCustodyRecords(custodyRecords);
  const checkMap = buildCheckMap(checks);
  const readinessScore = clamp(readiness?.score ?? 0.68, 0, 1);

  const phases = buildPhaseProjections({
    startDate,
    docStats,
    readinessScore,
    licenseCheck: checkMap.license,
    npdbCheck: checkMap.npdb,
  });

  const bottlenecks = predictBottlenecks({
    docStats,
    licenseCheck: checkMap.license,
    npdbCheck: checkMap.npdb,
  });

  const expediteSuggestions = buildExpediteSuggestions({
    docStats,
    licenseCheck: checkMap.license,
    boardCheck: checkMap.board,
    compactCheck: checkMap.compact,
  });

  const velocity = buildVelocityModel({
    phases,
    referenceDate,
    readinessScore,
  });

  const worstBottleneck = bottlenecks.reduce((max, current) => Math.max(max, current.confidence), 0);
  const efficiency = buildEfficiencyScore({
    readinessScore,
    docQuality: docStats.quality,
    automationCoverage: docStats.automationCoverage,
    bottleneckSeverity: worstBottleneck,
  });

  const exportPayload = buildExportPayload({
    clinicianId: input.clinicianId,
    orgId: input.orgId,
    phases,
    efficiency,
    readinessScore,
  });

  await persistKineticsSnapshot(input.clinicianId, phases);

  await anchorOnboardingKineticsSnapshot({
    clinicianId: input.clinicianId,
    orgId: input.orgId ?? null,
    projectedCompletionDate: velocity.projectedCompletionDate,
    efficiencyScore: efficiency.overall,
    readinessScore,
    phases,
    bottlenecks,
  }).catch((error) => console.warn('[onboarding][anchor] failed', error));

  return {
    clinicianId: input.clinicianId,
    orgId: input.orgId,
    phases,
    velocity,
    bottlenecks,
    expediteSuggestions,
    efficiency,
    exportPayload,
  };
}

export function dedupeKineticsRecords(
  records: OnboardingKineticsRecord[],
): OnboardingKineticsRecord[] {
  const latest = new Map<string, OnboardingKineticsRecord>();
  records.forEach((record) => {
    const key = `${record.clinicianId}:${record.phase.toLowerCase()}`;
    const existing = latest.get(key);
    if (!existing || existing.timestamp < record.timestamp) {
      latest.set(key, record);
    }
  });
  return Array.from(latest.values());
}

export function computeHeatmapSnapshot(records: OnboardingKineticsRecord[]): HeatmapSummary {
  const phaseDurations = new Map<OnboardingPhase, number[]>();
  const phasePressures = new Map<OnboardingPhase, number[]>();
  const bottleneckSamples = new Map<BottleneckType, number[]>();
  const clinicianTotals = new Map<string, number>();

  records.forEach((record) => {
    if (!ONBOARDING_PHASES.includes(record.phase as OnboardingPhase)) {
      return;
    }
    const phase = record.phase as OnboardingPhase;
    const durations = phaseDurations.get(phase) ?? [];
    durations.push(record.durationDays);
    phaseDurations.set(phase, durations);

    const pressure = extractPeakPressure(record.bottlenecks);
    const pressures = phasePressures.get(phase) ?? [];
    pressures.push(pressure);
    phasePressures.set(phase, pressures);

    const normalized = normalizeBottleneckRecord(record.bottlenecks);
    (Object.keys(normalized) as BottleneckType[]).forEach((type) => {
      const arr = bottleneckSamples.get(type) ?? [];
      arr.push(normalized[type]);
      bottleneckSamples.set(type, arr);
    });

    clinicianTotals.set(record.clinicianId, (clinicianTotals.get(record.clinicianId) ?? 0) + record.durationDays);
  });

  const cells: HeatmapCell[] = ONBOARDING_PHASES.map((phase) => {
    const durations = phaseDurations.get(phase) ?? [];
    const pressures = phasePressures.get(phase) ?? [];
    const avgDuration = durations.length ? average(durations) : 0;
    const medianDuration = durations.length ? median(durations) : 0;
    const bottleneckPressure = pressures.length ? average(pressures) : 0;
    return {
      phase,
      avgDuration: Number(avgDuration.toFixed(2)),
      medianDuration: Number(medianDuration.toFixed(2)),
      sampleSize: durations.length,
      bottleneckPressure: Number(bottleneckPressure.toFixed(3)),
      severity: classifyHeatmapSeverity(avgDuration, bottleneckPressure),
    };
  });

  const topBottlenecks = Array.from(bottleneckSamples.entries())
    .map(([type, values]) => {
      const avg = values.length ? average(values) : 0;
      const severity = avg >= 0.7 ? 'high' : avg >= 0.45 ? 'moderate' : 'low';
      return {
        type,
        frequency: values.filter((value) => value >= 0.4).length,
        severity,
        sampleSize: values.length,
      };
    })
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  const readinessBands = buildReadinessBands(Array.from(clinicianTotals.values()));

  return {
    cells,
    topBottlenecks,
    readinessBands,
    clinicianTotals: clinicianTotals.size,
  };
}

export function buildBulkExportFromKinetics(
  records: OnboardingKineticsRecord[],
): AggregatedExportRow[] {
  const grouped = new Map<string, Partial<Record<OnboardingPhase, OnboardingKineticsRecord>>>();

  records.forEach((record) => {
    if (!ONBOARDING_PHASES.includes(record.phase as OnboardingPhase)) {
      return;
    }
    const phase = record.phase as OnboardingPhase;
    const bucket =
      grouped.get(record.clinicianId) ?? ({} as Partial<Record<OnboardingPhase, OnboardingKineticsRecord>>);
    const existing = bucket[phase];
    if (!existing || existing.timestamp < record.timestamp) {
      bucket[phase] = record;
    }
    grouped.set(record.clinicianId, bucket);
  });

  return Array.from(grouped.entries()).map(([clinicianId, phaseMap]) => {
    const docsDuration = phaseMap.docs?.durationDays ?? 0;
    const verificationDuration = phaseMap.verification?.durationDays ?? 0;
    const committeeDuration = phaseMap.committee?.durationDays ?? 0;
    const itAccessDuration = phaseMap.itAccess?.durationDays ?? 0;
    const onboardingDuration = phaseMap.onboarding?.durationDays ?? 0;
    const totalDuration =
      docsDuration + verificationDuration + committeeDuration + itAccessDuration + onboardingDuration;
    const timestamps = Object.values(phaseMap)
      .filter((record): record is OnboardingKineticsRecord => Boolean(record))
      .map((record) => record.timestamp)
      .filter(Boolean)
      .sort((a, b) => (a < b ? 1 : -1));
    const lastUpdated = timestamps[0]?.toISOString?.() ?? new Date().toISOString();

    const riskiestPhase = determineRiskiestPhase(phaseMap);
    const dominantBottleneck = determineDominantBottleneck(phaseMap);

    return {
      clinicianId,
      docsDuration,
      verificationDuration,
      committeeDuration,
      itAccessDuration,
      onboardingDuration,
      totalDuration,
      lastUpdated,
      riskiestPhase,
      dominantBottleneck,
    };
  });
}

export function serializeAggregatedRowsToCsv(rows: AggregatedExportRow[]): string {
  const header = [
    'clinicianId',
    'docsDuration',
    'verificationDuration',
    'committeeDuration',
    'itAccessDuration',
    'onboardingDuration',
    'totalDuration',
    'lastUpdated',
    'riskiestPhase',
    'dominantBottleneck',
  ].join(',');

  const body = rows
    .map((row) =>
      [
        row.clinicianId,
        row.docsDuration,
        row.verificationDuration,
        row.committeeDuration,
        row.itAccessDuration,
        row.onboardingDuration,
        row.totalDuration,
        row.lastUpdated,
        row.riskiestPhase,
        row.dominantBottleneck ?? '',
      ]
        .map((value) => (typeof value === 'string' ? `"${value}"` : value))
        .join(','),
    )
    .join('\n');

  return [header, body].filter(Boolean).join('\n');
}

function analyzeCustodyRecords(records: CustodyRecord[]): DocumentStats {
  if (!records.length) {
    return {
      uploads: 0,
      verified: 0,
      anchored: 0,
      lastActionAt: null,
      coverageRatio: 0,
      missingDocumentsScore: 1,
      automationCoverage: 0,
      freshnessDays: 90,
      quality: 0,
    };
  }

  const uploads = records.filter((record) => record.action === 'upload').length;
  const verified = records.filter((record) => record.action === 'verified').length;
  const anchored = records.filter((record) => record.action === 'anchored').length;
  const coverageRatio = uploads ? clamp(verified / uploads, 0, 1) : 0;
  const automationCoverage = uploads ? clamp(anchored / uploads, 0, 1) : 0;
  const missingDocumentsScore = clamp(1 - coverageRatio, 0, 1);
  const lastAction = records[0];
  const freshnessMs = lastAction?.timestamp ? Date.now() - lastAction.timestamp.getTime() : Number.NaN;
  const freshnessDays = Number.isFinite(freshnessMs) ? freshnessMs / ONE_DAY_MS : 90;
  const quality = clamp(coverageRatio * 0.8 + automationCoverage * 0.2, 0, 1);

  return {
    uploads,
    verified,
    anchored,
    lastActionAt: lastAction?.timestamp?.toISOString() ?? null,
    coverageRatio,
    missingDocumentsScore,
    automationCoverage,
    freshnessDays: Math.max(0, Math.round(freshnessDays)),
    quality,
  };
}

function buildPhaseProjections(context: PhaseProjectionContext): PhaseProjection[] {
  let cursor = new Date(context.startDate);
  return ONBOARDING_PHASES.map((phase) => {
    let duration = BASE_PHASE_DURATIONS[phase];

    if (phase === 'docs') {
      duration *= 1 + context.docStats.missingDocumentsScore * 0.9;
      duration *= 1 + Math.min(context.docStats.freshnessDays / 60, 1) * 0.2;
    } else if (phase === 'verification') {
      duration *= 1 + deriveLicenseRisk(context.licenseCheck) * 0.6 + deriveNpdbRisk(context.npdbCheck) * 0.4;
    } else if (phase === 'committee') {
      duration *= 1 + (1 - context.readinessScore) * 0.5;
    } else if (phase === 'itAccess') {
      duration *= 1 - context.docStats.automationCoverage * 0.35;
    } else if (phase === 'onboarding') {
      duration *= 1 - context.readinessScore * 0.2;
    }

    duration = clamp(duration, 1, 30);

    const start = cursor;
    const projectedCompletion = addDays(start, duration);
    cursor = new Date(projectedCompletion);

    const bottleneckRisk = buildPhaseBottleneckRisk(
      phase,
      context.docStats,
      context.licenseCheck,
      context.npdbCheck,
    );

    const activeRisks = Object.values(bottleneckRisk);
    const confidence = clamp(1 - average(activeRisks), 0.25, 0.95);

    return {
      phase,
      durationDays: Number(duration.toFixed(2)),
      startDate: start.toISOString(),
      projectedCompletion: projectedCompletion.toISOString(),
      confidence: Number(confidence.toFixed(3)),
      bottleneckRisk,
    };
  });
}

function buildPhaseBottleneckRisk(
  phase: OnboardingPhase,
  docStats: DocumentStats,
  licenseCheck?: ContinuousCheck,
  npdbCheck?: ContinuousCheck,
): Record<BottleneckType, number> {
  const risks: Record<BottleneckType, number> = {
    missingDocuments: 0,
    expiredLicenses: 0,
    unverifiedNpdb: 0,
  };

  if (phase === 'docs') {
    risks.missingDocuments = docStats.missingDocumentsScore;
  }
  if (phase === 'verification' || phase === 'committee' || phase === 'itAccess') {
    risks.expiredLicenses = deriveLicenseRisk(licenseCheck) * (phase === 'verification' ? 1 : 0.5);
    risks.unverifiedNpdb = deriveNpdbRisk(npdbCheck) * (phase === 'verification' ? 1 : 0.6);
  }
  if (phase === 'onboarding') {
    risks.unverifiedNpdb = deriveNpdbRisk(npdbCheck) * 0.4;
  }

  return {
    missingDocuments: Number(risks.missingDocuments.toFixed(3)),
    expiredLicenses: Number(risks.expiredLicenses.toFixed(3)),
    unverifiedNpdb: Number(risks.unverifiedNpdb.toFixed(3)),
  };
}

function predictBottlenecks(context: {
  docStats: DocumentStats;
  licenseCheck?: ContinuousCheck;
  npdbCheck?: ContinuousCheck;
}): BottleneckPrediction[] {
  const predictions: BottleneckPrediction[] = [];

  if (context.docStats.missingDocumentsScore >= 0.25) {
    predictions.push({
      type: 'missingDocuments',
      severity: classifySeverityFromScore(context.docStats.missingDocumentsScore),
      confidence: Number(
        clamp(context.docStats.missingDocumentsScore + (context.docStats.freshnessDays > 45 ? 0.1 : 0), 0, 1).toFixed(3),
      ),
      signals: [
        `Coverage ${(context.docStats.coverageRatio * 100).toFixed(0)}%`,
        `${context.docStats.uploads - context.docStats.verified} documents awaiting verification`,
      ],
      recommendedActions: ['Request missing primary source docs', 'Trigger auto-ingest for outstanding uploads'],
    });
  }

  const licenseRisk = deriveLicenseRisk(context.licenseCheck);
  if (licenseRisk >= 0.45) {
    predictions.push({
      type: 'expiredLicenses',
      severity: classifySeverityFromScore(licenseRisk),
      confidence: Number(licenseRisk.toFixed(3)),
      signals: buildLicenseSignals(context.licenseCheck),
      recommendedActions: ['Renew expiring state license', 'Escalate PSV packet for manual attestation'],
    });
  }

  const npdbRisk = deriveNpdbRisk(context.npdbCheck);
  if (npdbRisk >= 0.4) {
    predictions.push({
      type: 'unverifiedNpdb',
      severity: classifySeverityFromScore(npdbRisk),
      confidence: Number(npdbRisk.toFixed(3)),
      signals: ['NPDB query awaiting acknowledgement', 'Queue automated NPDB follow-up'],
      recommendedActions: ['Confirm NPDB attestation', 'Route NPDB attestation to committee packet reviewer'],
    });
  }

  return predictions;
}

function buildExpediteSuggestions(context: {
  docStats: DocumentStats;
  licenseCheck?: ContinuousCheck;
  boardCheck?: ContinuousCheck;
  compactCheck?: ContinuousCheck;
}): AutoExpediteSuggestion[] {
  const suggestions: AutoExpediteSuggestion[] = [];
  const licenseRisk = deriveLicenseRisk(context.licenseCheck);
  if (licenseRisk >= 0.55) {
    suggestions.push({
      type: 'licenseRenewal',
      impactScore: Number(licenseRisk.toFixed(3)),
      rationale: 'Primary license expires within 45 days or flagged as inactive.',
      recommendedAction: 'Launch renewal packet with auto-filled board data and supervisor attestation.',
      blocking: true,
    });
  }

  if (isCheckStale(context.boardCheck, 180)) {
    suggestions.push({
      type: 'boardCertUpdate',
      impactScore: 0.58,
      rationale: 'Board certification verification older than 6 months.',
      recommendedAction: 'Request digital verification or pull updated CE transcript.',
      blocking: false,
    });
  }

  if (!isCompactEligible(context.compactCheck)) {
    suggestions.push({
      type: 'compactEnrollment',
      impactScore: 0.46,
      rationale: 'Clinician not yet part of compact authority; multi-state coverage limited.',
      recommendedAction: 'Enroll in eNLC fast-path to unlock cross-state telehealth onboarding.',
      blocking: false,
    });
  }

  if (context.docStats.missingDocumentsScore >= 0.35 && !suggestions.some((s) => s.type === 'licenseRenewal')) {
    suggestions.push({
      type: 'licenseRenewal',
      impactScore: 0.42,
      rationale: 'Document backlog will trigger credentialing SLA breach without escalation.',
      recommendedAction: 'Enable auto-expedite workflow for outstanding verification packets.',
      blocking: false,
    });
  }

  return suggestions.sort((a, b) => b.impactScore - a.impactScore);
}

function buildVelocityModel({
  phases,
  referenceDate,
  readinessScore,
}: {
  phases: PhaseProjection[];
  referenceDate: Date;
  readinessScore: number;
}): OnboardingVelocityModel {
  const totalDays = phases.reduce((sum, phase) => sum + phase.durationDays, 0);
  const projectedCompletionDate = phases.at(-1)?.projectedCompletion ?? new Date(referenceDate).toISOString();

  let currentPhase: OnboardingPhase = phases[0]?.phase ?? 'docs';
  let progress = 0;
  const referenceMs = referenceDate.getTime();

  phases.forEach((phase) => {
    const startMs = new Date(phase.startDate).getTime();
    const endMs = new Date(phase.projectedCompletion).getTime();
    if (referenceMs >= endMs) {
      progress += phase.durationDays / Math.max(totalDays, 1);
      return;
    }
    if (referenceMs >= startMs && referenceMs < endMs) {
      currentPhase = phase.phase;
      const phaseProgress = (referenceMs - startMs) / Math.max(endMs - startMs, 1);
      progress += (phase.durationDays / Math.max(totalDays, 1)) * clamp(phaseProgress, 0, 1);
    }
  });

  const etaConfidence = clamp(
    (phases.reduce((sum, phase) => sum + phase.confidence, 0) / Math.max(phases.length, 1) + readinessScore) / 2,
    0.35,
    0.98,
  );

  return {
    projectedCompletionDate,
    projectedDays: Number(totalDays.toFixed(2)),
    currentPhase,
    progressPercent: Number((progress * 100).toFixed(2)),
    etaConfidence: Number(etaConfidence.toFixed(3)),
  };
}

function buildEfficiencyScore(context: EfficiencyContext): EfficiencyScoreBreakdown {
  const penalty = clamp(1 - context.bottleneckSeverity, 0, 1);
  const overall =
    context.readinessScore * 0.45 +
    context.docQuality * 0.3 +
    context.automationCoverage * 0.15 +
    penalty * 0.1;

  return {
    overall: Number(overall.toFixed(4)),
    readiness: Number(context.readinessScore.toFixed(4)),
    documentQuality: Number(context.docQuality.toFixed(4)),
    automation: Number(context.automationCoverage.toFixed(4)),
    penalty: Number(penalty.toFixed(4)),
  };
}

function buildExportPayload(args: {
  clinicianId: string;
  orgId?: string;
  phases: PhaseProjection[];
  efficiency: EfficiencyScoreBreakdown;
  readinessScore: number;
}): { rows: OnboardingExportRow[]; csv: string } {
  const rows: OnboardingExportRow[] = args.phases.map((phase) => ({
    clinicianId: args.clinicianId,
    orgId: args.orgId,
    phase: phase.phase,
    durationDays: phase.durationDays,
    startDate: phase.startDate,
    projectedCompletion: phase.projectedCompletion,
    bottleneckPressure: Number(Math.max(...Object.values(phase.bottleneckRisk)).toFixed(3)),
    efficiencyScore: args.efficiency.overall,
    readinessScore: args.readinessScore,
  }));

  const csv = [
    'clinicianId,orgId,phase,durationDays,startDate,projectedCompletion,bottleneckPressure,efficiencyScore,readinessScore',
    ...rows.map((row) =>
      [
        row.clinicianId,
        row.orgId ?? '',
        row.phase,
        row.durationDays,
        row.startDate,
        row.projectedCompletion,
        row.bottleneckPressure,
        row.efficiencyScore,
        row.readinessScore,
      ]
        .map((value) => (typeof value === 'string' ? `"${value}"` : value))
        .join(','),
    ),
  ].join('\n');

  return { rows, csv };
}

async function persistKineticsSnapshot(clinicianId: string, phases: PhaseProjection[]) {
  if (!phases.length) {
    return;
  }

  await prisma.$transaction(
    phases.map((phase) =>
      prisma.onboardingKinetics.create({
        data: {
          clinicianId,
          phase: phase.phase,
          durationDays: Math.round(phase.durationDays),
          bottlenecks: phase.bottleneckRisk,
        },
      }),
    ),
    { timeout: 15_000 },
  );
}

function buildCheckMap(checks: ContinuousCheck[]) {
  const map: Record<string, ContinuousCheck | undefined> = {};
  checks.forEach((check) => {
    if (!map[check.type]) {
      map[check.type] = check;
    }
  });
  return {
    license: map.license,
    board: map.board,
    npdb: map.npdb,
    compact: map.compact,
  };
}

function deriveLicenseRisk(check?: ContinuousCheck): number {
  if (!check) return 0.5;
  const payload = normalizeCheckResult(check);
  if (!payload) return 0.5;
  if (payload.status.includes('expired') || payload.status.includes('revoked')) {
    return 0.95;
  }
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  if (expiresAt) {
    const daysUntil = (expiresAt.getTime() - Date.now()) / ONE_DAY_MS;
    if (daysUntil < 0) return 0.95;
    if (daysUntil < 30) return 0.78;
    if (daysUntil < 60) return 0.6;
  }
  return payload.status.includes('pending') ? 0.55 : 0.2;
}

function deriveNpdbRisk(check?: ContinuousCheck): number {
  if (!check) return 0.5;
  const payload = normalizeCheckResult(check);
  if (!payload) return 0.5;
  if (payload.status.includes('verified')) {
    return 0.2;
  }
  if (payload.status.includes('flag') || payload.status.includes('adverse')) {
    return 0.85;
  }
  return payload.status.includes('pending') ? 0.6 : 0.45;
}

function buildLicenseSignals(check?: ContinuousCheck): string[] {
  if (!check) {
    return ['No recent license verification record'];
  }
  const payload = normalizeCheckResult(check);
  if (!payload) return ['Unable to parse license verification payload'];
  const signals = [`Status: ${payload.status}`];
  if (payload.expiresAt) {
    signals.push(`Expires ${new Date(payload.expiresAt).toLocaleDateString()}`);
  }
  return signals;
}

function normalizeCheckResult(check: ContinuousCheck): {
  status: string;
  expiresAt?: string | null;
} | null {
  if (!check) return null;
  const payload = (check.result ?? {}) as Record<string, any>;
  const status = String(payload.status ?? payload.state ?? 'unknown').toLowerCase();
  const expiresAt =
    typeof payload.expiresAt === 'string'
      ? payload.expiresAt
      : typeof payload.expirationDate === 'string'
      ? payload.expirationDate
      : undefined;
  return { status, expiresAt };
}

function isCheckStale(check: ContinuousCheck | undefined, maxAgeDays: number): boolean {
  if (!check) return true;
  const ageDays = (Date.now() - check.runAt.getTime()) / ONE_DAY_MS;
  return ageDays > maxAgeDays;
}

function isCompactEligible(check?: ContinuousCheck): boolean {
  if (!check) return false;
  const payload = (check.result ?? {}) as Record<string, any>;
  if (typeof payload.eligible === 'boolean') return payload.eligible;
  if (typeof payload.status === 'string') {
    return payload.status.toLowerCase().includes('eligible');
  }
  return false;
}

function classifySeverityFromScore(score: number): 'low' | 'moderate' | 'high' {
  if (score >= 0.75) return 'high';
  if (score >= 0.45) return 'moderate';
  return 'low';
}

function classifyHeatmapSeverity(avgDuration: number, pressure: number): 'stable' | 'warning' | 'critical' {
  if (avgDuration >= 14 || pressure >= 0.72) return 'critical';
  if (avgDuration >= 10 || pressure >= 0.5) return 'warning';
  return 'stable';
}

function buildReadinessBands(totals: number[]) {
  const bands = [
    { label: 'Ready ≤10d', count: 0, max: 10 },
    { label: '11-20d', count: 0, max: 20 },
    { label: '21-30d', count: 0, max: 30 },
    { label: 'Slow lane >30d', count: 0, max: Infinity },
  ];

  totals.forEach((total) => {
    for (const band of bands) {
      if (total <= band.max) {
        band.count += 1;
        break;
      }
    }
  });

  return bands.map(({ label, count }) => ({ label, count }));
}

function determineRiskiestPhase(
  phaseMap: Partial<Record<OnboardingPhase, OnboardingKineticsRecord>>,
): OnboardingPhase {
  let riskiest: OnboardingPhase = 'docs';
  let highest = -1;
  ONBOARDING_PHASES.forEach((phase) => {
    const record = phaseMap[phase];
    if (!record) return;
    const risk = extractPeakPressure(record.bottlenecks);
    if (risk > highest) {
      highest = risk;
      riskiest = phase;
    }
  });
  return riskiest;
}

function determineDominantBottleneck(
  phaseMap: Partial<Record<OnboardingPhase, OnboardingKineticsRecord>>,
): BottleneckType | null {
  const totals: Record<BottleneckType, number> = {
    missingDocuments: 0,
    expiredLicenses: 0,
    unverifiedNpdb: 0,
  };
  let count = 0;

  ONBOARDING_PHASES.forEach((phase) => {
    const record = phaseMap[phase];
    if (!record) return;
    const normalized = normalizeBottleneckRecord(record.bottlenecks);
    (Object.keys(normalized) as BottleneckType[]).forEach((key) => {
      totals[key] += normalized[key];
    });
    count += 1;
  });

  if (!count) return null;
  const entries = Object.entries(totals) as [BottleneckType, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] > 0 ? entries[0][0] : null;
}

function normalizeBottleneckRecord(value: unknown): Record<BottleneckType, number> {
  const payload = (value as Record<string, unknown>) ?? {};
  return {
    missingDocuments: clamp(Number(payload.missingDocuments ?? 0), 0, 1),
    expiredLicenses: clamp(Number(payload.expiredLicenses ?? 0), 0, 1),
    unverifiedNpdb: clamp(Number(payload.unverifiedNpdb ?? 0), 0, 1),
  };
}

function extractPeakPressure(value: unknown): number {
  const normalized = normalizeBottleneckRecord(value);
  return Math.max(...Object.values(normalized));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}


