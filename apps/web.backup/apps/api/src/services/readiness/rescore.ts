import { PrismaClient, type ContinuousCheck, Prisma } from '@prisma/client';
import {
  ReadinessEngine,
  buildDefaultSignals,
  type ReadinessSignals,
  type ReadinessEngineResult,
} from './engine';
import {
  evaluateRecruiterAlerts,
  type RecruiterAlert,
} from '../../services/alerts/recruiter';
import { enqueueReadinessUpdate } from '../ats/events';

const prisma = new PrismaClient();
const engine = new ReadinessEngine();

export interface ContinuousCheckSource {
  type: string;
  status?: 'pass' | 'warn' | 'fail';
  [key: string]: unknown;
}

export interface ReadinessRescoreOptions {
  sources?: ContinuousCheckSource[];
}

export interface ReadinessRescoreResult {
  clinicianId: string;
  score: number;
  evaluation: ReadinessEngineResult;
  alerts: RecruiterAlert[];
}

export async function recomputeReadinessFromContinuousChecks(
  clinicianId: string,
  options: ReadinessRescoreOptions = {},
): Promise<ReadinessRescoreResult> {
  const latestScore = await prisma.clinicianReadinessScore.findUnique({
    where: { clinicianId },
  });

  const signals = await buildSignalsFromContinuousChecks(
    clinicianId,
    options.sources,
  );

  const evaluation = await engine.evaluateAndStore(signals);

  const alerts = evaluateRecruiterAlerts({
    clinicianId,
    readinessScoreBefore: latestScore?.score,
    readinessScoreAfter: evaluation.score,
  });

  await enqueueReadinessUpdate({
    clinicianId,
    before: latestScore?.score ?? null,
    after: evaluation.score,
  }).catch((error) =>
    console.warn('[readiness][ats] failed to queue readiness update', {
      clinicianId,
      error,
    }),
  );

  return {
    clinicianId,
    score: evaluation.score,
    evaluation,
    alerts,
  };
}

async function buildSignalsFromContinuousChecks(
  clinicianId: string,
  stagedSources: ContinuousCheckSource[] = [],
): Promise<ReadinessSignals> {
  const latestPersisted = await fetchLatestCheckMap(clinicianId);
  const merged = latestPersisted;

  for (const source of stagedSources) {
    if (!source?.type) continue;
    merged.set(source.type, source);
  }

  const signals = buildDefaultSignals(clinicianId);

  const license = merged.get('license');
  if (license) {
    applyLicenseSignal(signals, license);
  }

  const sanctions = merged.get('sanctions');
  if (sanctions) {
    applySanctionsSignal(signals, sanctions);
  }

  const npdb = merged.get('npdb');
  if (npdb) {
    applyNpdbSignal(signals, npdb);
  }

  const compact = merged.get('compact');
  if (compact) {
    applyCompactSignal(signals, compact);
  }

  return signals;
}

async function fetchLatestCheckMap(
  clinicianId: string,
): Promise<Map<string, ContinuousCheckSource>> {
  const rows = await prisma.continuousCheck.findMany({
    where: { clinicianId },
    orderBy: { runAt: 'desc' },
    take: 25,
  });

  const map = new Map<string, ContinuousCheckSource>();
  for (const row of rows) {
    if (map.has(row.type)) {
      continue;
    }
    const payload = coerceSource(row);
    if (payload) {
      map.set(row.type, payload);
    }
  }
  return map;
}

function applyLicenseSignal(
  signals: ReadinessSignals,
  payload: ContinuousCheckSource,
) {
  const freshnessHours = numberFrom(payload.freshnessHours);
  if (Number.isFinite(freshnessHours)) {
    signals.licenseFreshnessDays = Math.max(freshnessHours / 24, 0);
  }
}

function applySanctionsSignal(
  signals: ReadinessSignals,
  payload: ContinuousCheckSource,
) {
  const adverseActions = numberFrom(payload.adverseActionCount);
  const hasHit =
    payload.status === 'fail' ||
    Boolean(payload.hasHit) ||
    (Number.isFinite(adverseActions) && adverseActions > 0);

  signals.sanctionsProbability = hasHit ? 0.85 : 0.08;
}

function applyNpdbSignal(
  signals: ReadinessSignals,
  payload: ContinuousCheckSource,
) {
  const adverseActions = numberFrom(payload.adverseActionCount);
  const lastReportAt =
    typeof payload.lastCheckedAt === 'string' ? payload.lastCheckedAt : undefined;

  signals.npdbHistory = {
    adverseActions: Number.isFinite(adverseActions) ? Math.max(adverseActions, 0) : 0,
    lastReportAt,
  };
}

function applyCompactSignal(
  signals: ReadinessSignals,
  payload: ContinuousCheckSource,
) {
  const eligibleStates = Array.isArray(payload.eligibleStates)
    ? (payload.eligibleStates as string[])
    : [];

  if (eligibleStates.length >= 5) {
    signals.compactEligibility = 'FULL';
    return;
  }

  if (eligibleStates.length > 0) {
    signals.compactEligibility = 'PARTIAL';
    return;
  }

  signals.compactEligibility = 'NONE';
}

function coerceSource(row: ContinuousCheck): ContinuousCheckSource | null {
  if (!row.result || typeof row.result !== 'object') {
    return null;
  }

  const value = row.result as Prisma.JsonObject;
  const type = typeof value.type === 'string' ? value.type : row.type;
  return {
    type,
    ...value,
  };
}

function numberFrom(value: unknown): number {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

