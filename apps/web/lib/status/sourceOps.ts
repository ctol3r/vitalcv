import {
  buildSourceHealthFreshness,
  createCanonicalSourceCoverage,
  summarizeCanonicalSourceCoverage,
  type CanonicalSourceCoverage,
} from '@vitalcv/trust-state';
import { getBackendBase } from '@/lib/api';
import type { SourceOpsEntry, SourceOpsReport } from '@/lib/mission-ops/sourceOpsTypes';

const STATUS_FETCH_TIMEOUT_MS = 12_000;
const STATUS_FETCH_BACKOFF_MS = [0, 250, 750] as const;

type SourceFallbackSeed = Readonly<{
  sourceId: SourceOpsEntry['sourceId'];
  name: SourceOpsEntry['name'];
  isSpine: SourceOpsEntry['isSpine'];
  decisionGrade: SourceOpsEntry['decisionGrade'];
  coverageState: SourceOpsEntry['coverageState'];
  coverageReason: SourceOpsEntry['coverageReason'];
  operatorStatus: SourceOpsEntry['operatorStatus'];
  featureFlag: SourceOpsEntry['featureFlag'];
  freshnessSlaHours: SourceOpsEntry['freshnessSlaHours'];
}>;

export type SourceOpsFetchResult = Readonly<{
  report: SourceOpsReport;
  isFallback: boolean;
  error: string | null;
}>;

const FALLBACK_SOURCE_SEEDS: readonly SourceFallbackSeed[] = [
  {
    sourceId: 'NPPES_API',
    name: 'CMS NPPES Registry',
    isSpine: true,
    decisionGrade: true,
    coverageState: 'checked',
    coverageReason: 'Configured as a live launch-lane source. This fallback reflects product posture, not a fresh runtime heartbeat.',
    operatorStatus: 'HEALTHY',
    featureFlag: { key: 'NPPES_ENABLED', enabled: true },
    freshnessSlaHours: 168,
  },
  {
    sourceId: 'OIG_LEIE',
    name: 'OIG / LEIE',
    isSpine: true,
    decisionGrade: true,
    coverageState: 'checked',
    coverageReason: 'Configured as a live launch-lane source. This fallback reflects product posture, not a fresh runtime heartbeat.',
    operatorStatus: 'HEALTHY',
    featureFlag: { key: 'OIG_LEIE_ENABLED', enabled: true },
    freshnessSlaHours: 24,
  },
  {
    sourceId: 'PECOS_PUBLIC',
    name: 'CMS PECOS',
    isSpine: true,
    decisionGrade: true,
    coverageState: 'stale',
    coverageReason: 'PECOS is source-backed but snapshot-based. This fallback marks it as a dated source until a live refresh succeeds.',
    operatorStatus: 'STALE',
    featureFlag: { key: 'PECOS_ENABLED', enabled: true },
    freshnessSlaHours: 2160,
  },
  {
    sourceId: 'STATE_BOARD',
    name: 'Configured state board lane',
    isSpine: true,
    decisionGrade: false,
    coverageState: 'accessRequired',
    coverageReason: 'State-board authority remains access-controlled until the launch-state adapter is configured.',
    operatorStatus: 'HEALTHY',
    featureFlag: { key: 'STATE_BOARD_ENABLED', enabled: false },
    freshnessSlaHours: 72,
  },
  {
    sourceId: 'NURSYS',
    name: 'Nursys',
    isSpine: false,
    decisionGrade: false,
    coverageState: 'gated',
    coverageReason: 'Institutional access is still required before Nursys can produce decision-grade coverage.',
    operatorStatus: 'HEALTHY',
    featureFlag: { key: 'REAL_NURSYS_ENABLED', enabled: false },
    freshnessSlaHours: 24,
  },
  {
    sourceId: 'FSMB',
    name: 'FSMB',
    isSpine: false,
    decisionGrade: false,
    coverageState: 'gated',
    coverageReason: 'Institutional access is still required before FSMB can produce decision-grade coverage.',
    operatorStatus: 'HEALTHY',
    featureFlag: { key: 'FSMB_ENABLED', enabled: false },
    freshnessSlaHours: 72,
  },
] as const;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchLiveSourceOpsReport(): Promise<SourceOpsReport> {
  let lastError: Error | null = null;

  for (const delayMs of STATUS_FETCH_BACKOFF_MS) {
    if (delayMs > 0) {
      await wait(delayMs);
    }

    try {
      const response = await fetch(`${getBackendBase()}/api/mission-ops/sources`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(STATUS_FETCH_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`Source health request failed with status ${response.status}.`);
      }

      return await response.json() as SourceOpsReport;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown source health fetch failure.');
      console.error('[status] source ops fetch attempt failed', {
        message: lastError.message,
        backendBase: getBackendBase(),
      });
    }
  }

  throw lastError ?? new Error('Source health request failed after all retries.');
}

function buildFallbackSourceOpsReport(now = new Date()): SourceOpsReport {
  let checks: CanonicalSourceCoverage[] = [];
  const sources: SourceOpsEntry[] = FALLBACK_SOURCE_SEEDS.map((seed) => {
    try {
      const coverage = createCanonicalSourceCoverage({
        sourceId: seed.sourceId,
        state: seed.coverageState,
        reason: seed.coverageReason,
        checkedAt: null,
        freshnessWindowHours: seed.freshnessSlaHours,
      });
      checks.push(coverage);
    } catch {
      // Fallback coverage construction failed — continue without it
    }

    let freshness: SourceOpsEntry['freshness'];
    try {
      freshness = buildSourceHealthFreshness({
        coverageState: seed.coverageState,
        lastSuccessAt: null,
        freshnessWindowHours: seed.freshnessSlaHours,
        now,
      });
    } catch {
      freshness = buildSourceHealthFreshness({
        coverageState: 'stale',
        lastSuccessAt: null,
        freshnessWindowHours: seed.freshnessSlaHours,
        now: new Date(0),
      });
    }

    return {
      sourceId: seed.sourceId,
      name: seed.name,
      isSpine: seed.isSpine,
      supported: true,
      decisionGrade: seed.decisionGrade,
      coverageState: seed.coverageState,
      coverageReason: seed.coverageReason,
      operatorStatus: seed.operatorStatus,
      featureFlag: seed.featureFlag,
      lastSuccessAt: null,
      lastFailureAt: null,
      consecutiveFailures: 0,
      freshnessSlaHours: seed.freshnessSlaHours,
      freshness,
    };
  });

  let summary: ReturnType<typeof summarizeCanonicalSourceCoverage>;
  try {
    summary = summarizeCanonicalSourceCoverage(checks);
  } catch {
    summary = summarizeCanonicalSourceCoverage([]);
  }

  return {
    timestamp: now.toISOString(),
    sources,
    sourceCoverage: {
      checks,
      summary,
    },
    spineStatus: 'DEGRADED',
    alerts: [
      'FALLBACK: Live status could not be loaded. Showing configured launch-lane posture until the next successful source report.',
      'GATED: Institutional authority lanes remain access-controlled until their source adapters and credentials are configured.',
    ],
  };
}

export async function getSourceOpsReportWithFallback(): Promise<SourceOpsFetchResult> {
  try {
    const report = await fetchLiveSourceOpsReport();
    return {
      report,
      isFallback: false,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load live source status.';
    return {
      report: buildFallbackSourceOpsReport(),
      isFallback: true,
      error: message,
    };
  }
}
