/**
 * sourceRuntimeState.ts — E0 source liveness truth contract.
 *
 * A catalog entry, adapter file or enabled flag is not proof that a source is
 * live. Source liveness requires one canonical adapter, configuration, access,
 * a successful persisted SourceRun and a fresh persisted artifact.
 */

import prisma from '../../graphql/prisma_client';
import {
  getSource,
  listSources,
  type SourceDefinition,
} from './sourceCatalog';
import {
  getCanonicalSourceAdapter,
  isCanonicalSourceAdapterImplemented,
} from './canonicalSourceAdapters';

export type SourceRuntimeTruthState =
  | 'live'
  | 'gated'
  | 'access_required'
  | 'failed'
  | 'stale'
  | 'not_checked'
  | 'unavailable'
  | 'partial';

export type SourceLastRunStatus =
  | 'never'
  | 'success'
  | 'partial'
  | 'failed'
  | 'gated';

export type SourceFreshnessStatus = 'current' | 'stale' | 'unknown';

export type SourceOutcomeState =
  | 'clear'
  | 'positive'
  | 'possible_match'
  | 'not_listed'
  | 'not_checked'
  | 'unavailable'
  | 'access_required'
  | 'failed'
  | 'gated';

export interface SourceRunRuntimeSnapshot {
  sourceId: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
}

export interface SourceArtifactRuntimeSnapshot {
  id: string;
  source: string;
  fetchedAt: Date | null;
  observedAt: Date | null;
}

export interface SourceRuntimeStore {
  findLatestRun(sourceId: string): Promise<SourceRunRuntimeSnapshot | null>;
  findLatestSuccessfulRun(sourceId: string): Promise<SourceRunRuntimeSnapshot | null>;
  findLatestArtifact(sourceId: string): Promise<SourceArtifactRuntimeSnapshot | null>;
}

export interface SourceRuntimeObservation {
  latestRun: SourceRunRuntimeSnapshot | null;
  latestSuccessfulRun: SourceRunRuntimeSnapshot | null;
  latestArtifact: SourceArtifactRuntimeSnapshot | null;
}

export interface SourceRuntimeState {
  sourceId: string;
  sourceName: string;
  registered: boolean;
  adapterImplemented: boolean;
  canonicalEntryPoint: string | null;
  enabled: boolean;
  credentialsPresent: boolean | null;
  catalogLiveAvailable: boolean;
  runtimeState: SourceRuntimeTruthState;
  lastRunStatus: SourceLastRunStatus;
  latestRunRawStatus: string | null;
  lastSuccessfulAt: string | null;
  lastArtifactId: string | null;
  freshnessStatus: SourceFreshnessStatus;
  freshnessWindowHours: number;
  decisionGradeEligible: boolean;
  isLive: boolean;
  limitation: string | null;
  computedAt: string;
}

type RuntimePrisma = {
  sourceRun: {
    findFirst(args: Record<string, unknown>): Promise<SourceRunRuntimeSnapshot | null>;
  };
  verificationArtifact: {
    findFirst(args: Record<string, unknown>): Promise<SourceArtifactRuntimeSnapshot | null>;
  };
};

const runtimePrisma = prisma as unknown as RuntimePrisma;

const SUCCESS_RUN_STATUSES = new Set(['VERIFIED', 'ALERTED', 'SUCCESS', 'COMPLETED']);
const FAILED_RUN_STATUSES = new Set(['FAILED', 'QUARANTINED', 'CANCELLED']);
const PARTIAL_RUN_STATUSES = new Set([
  'QUEUED',
  'FETCHING',
  'FETCHED',
  'PARSING',
  'PARSED',
  'NORMALIZED',
  'RUNNING',
]);

export const prismaSourceRuntimeStore: SourceRuntimeStore = {
  async findLatestRun(sourceId) {
    return runtimePrisma.sourceRun.findFirst({
      where: { sourceId },
      orderBy: { createdAt: 'desc' },
      select: {
        sourceId: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });
  },

  async findLatestSuccessfulRun(sourceId) {
    return runtimePrisma.sourceRun.findFirst({
      where: {
        sourceId,
        status: { in: [...SUCCESS_RUN_STATUSES] },
      },
      orderBy: [
        { completedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      select: {
        sourceId: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });
  },

  async findLatestArtifact(sourceId) {
    return runtimePrisma.verificationArtifact.findFirst({
      where: { source: sourceId },
      orderBy: [
        { observedAt: 'desc' },
        { fetchedAt: 'desc' },
      ],
      select: {
        id: true,
        source: true,
        fetchedAt: true,
        observedAt: true,
      },
    });
  },
};

function isTruthyEnvironmentFlag(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

function hasEnvironmentValue(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function requiredCredentialsPresent(
  sourceId: string,
  environment: NodeJS.ProcessEnv,
): boolean | null {
  const adapter = getCanonicalSourceAdapter(sourceId);
  if (!adapter || adapter.requiredEnvironmentVariables.length === 0) {
    return null;
  }

  return adapter.requiredEnvironmentVariables.every((key) => hasEnvironmentValue(environment[key]));
}

function classifyLatestRun(status: string | null): SourceLastRunStatus {
  if (!status) return 'never';
  const normalized = status.toUpperCase();
  if (SUCCESS_RUN_STATUSES.has(normalized)) return 'success';
  if (FAILED_RUN_STATUSES.has(normalized)) return 'failed';
  if (PARTIAL_RUN_STATUSES.has(normalized)) return 'partial';
  return 'partial';
}

function latestObservationTime(
  observation: SourceRuntimeObservation,
): Date | null {
  return observation.latestArtifact?.observedAt
    ?? observation.latestArtifact?.fetchedAt
    ?? observation.latestSuccessfulRun?.completedAt
    ?? observation.latestSuccessfulRun?.createdAt
    ?? null;
}

function computeFreshness(
  source: SourceDefinition,
  observation: SourceRuntimeObservation,
  now: Date,
): SourceFreshnessStatus {
  const observedAt = latestObservationTime(observation);
  if (!observedAt) return 'unknown';

  const expiresAtMs = observedAt.getTime() + source.refreshSlaHours * 60 * 60 * 1000;
  return expiresAtMs >= now.getTime() ? 'current' : 'stale';
}

function limitationForState(
  state: SourceRuntimeTruthState,
  source: SourceDefinition,
): string | null {
  switch (state) {
    case 'live':
      return source.decisionGrade
        ? null
        : 'Source is live for contextual enrichment but is not decision-grade.';
    case 'gated':
      return 'Source is registered but disabled by runtime configuration.';
    case 'access_required':
      return 'Source requires credentials, contract access or institutional configuration.';
    case 'failed':
      return 'The latest source run failed or was quarantined. No clear result may be inferred.';
    case 'stale':
      return 'The latest successful artifact is outside the source freshness window.';
    case 'not_checked':
      return 'No successful persisted source run exists. This is not a clear result.';
    case 'unavailable':
      return 'The source is cataloged but no production-live canonical implementation is available.';
    case 'partial':
      return 'The latest run is incomplete or lacks a persisted source artifact.';
  }
}

export function buildSourceRuntimeState(
  source: SourceDefinition,
  observation: SourceRuntimeObservation,
  options: {
    environment?: NodeJS.ProcessEnv;
    now?: Date;
  } = {},
): SourceRuntimeState {
  const environment = options.environment ?? process.env;
  const now = options.now ?? new Date();
  const adapter = getCanonicalSourceAdapter(source.id);
  const adapterImplemented = isCanonicalSourceAdapterImplemented(source.id);
  const enabled = isTruthyEnvironmentFlag(environment[source.envFlag]);
  const credentialsPresent = requiredCredentialsPresent(source.id, environment);
  const latestRunRawStatus = observation.latestRun?.status ?? null;
  const classifiedLatestRun = classifyLatestRun(latestRunRawStatus);
  const freshnessStatus = computeFreshness(source, observation, now);

  let runtimeState: SourceRuntimeTruthState;

  if (!adapterImplemented) {
    runtimeState = 'unavailable';
  } else if (!enabled) {
    runtimeState = 'gated';
  } else if (credentialsPresent === false) {
    runtimeState = 'access_required';
  } else if (!source.liveAvailable) {
    runtimeState = 'unavailable';
  } else if (classifiedLatestRun === 'failed') {
    runtimeState = 'failed';
  } else if (classifiedLatestRun === 'partial') {
    runtimeState = 'partial';
  } else if (!observation.latestSuccessfulRun) {
    runtimeState = 'not_checked';
  } else if (!observation.latestArtifact) {
    runtimeState = 'partial';
  } else if (freshnessStatus === 'stale') {
    runtimeState = 'stale';
  } else if (freshnessStatus === 'unknown') {
    runtimeState = 'partial';
  } else {
    runtimeState = 'live';
  }

  const isLive = runtimeState === 'live';
  const lastRunStatus: SourceLastRunStatus =
    runtimeState === 'gated' || runtimeState === 'access_required' || runtimeState === 'unavailable'
      ? (observation.latestRun ? classifiedLatestRun : 'gated')
      : classifiedLatestRun;

  const successfulAt = observation.latestSuccessfulRun?.completedAt
    ?? observation.latestSuccessfulRun?.createdAt
    ?? null;

  return {
    sourceId: source.id,
    sourceName: source.name,
    registered: true,
    adapterImplemented,
    canonicalEntryPoint: adapter?.canonicalEntryPoint ?? null,
    enabled,
    credentialsPresent,
    catalogLiveAvailable: source.liveAvailable,
    runtimeState,
    lastRunStatus,
    latestRunRawStatus,
    lastSuccessfulAt: successfulAt?.toISOString() ?? null,
    lastArtifactId: observation.latestArtifact?.id ?? null,
    freshnessStatus,
    freshnessWindowHours: source.refreshSlaHours,
    decisionGradeEligible: isLive && source.decisionGrade,
    isLive,
    limitation: limitationForState(runtimeState, source),
    computedAt: now.toISOString(),
  };
}

async function observeSourceRuntime(
  sourceId: string,
  store: SourceRuntimeStore,
): Promise<SourceRuntimeObservation> {
  const [latestRun, latestSuccessfulRun, latestArtifact] = await Promise.all([
    store.findLatestRun(sourceId),
    store.findLatestSuccessfulRun(sourceId),
    store.findLatestArtifact(sourceId),
  ]);

  return { latestRun, latestSuccessfulRun, latestArtifact };
}

export async function getSourceRuntimeState(
  sourceId: string,
  options: {
    store?: SourceRuntimeStore;
    environment?: NodeJS.ProcessEnv;
    now?: Date;
  } = {},
): Promise<SourceRuntimeState | null> {
  const source = getSource(sourceId);
  if (!source) return null;

  const store = options.store ?? prismaSourceRuntimeStore;
  const observation = await observeSourceRuntime(sourceId, store);
  return buildSourceRuntimeState(source, observation, options);
}

export async function listSourceRuntimeStates(
  options: {
    store?: SourceRuntimeStore;
    environment?: NodeJS.ProcessEnv;
    now?: Date;
  } = {},
): Promise<SourceRuntimeState[]> {
  const store = options.store ?? prismaSourceRuntimeStore;
  const now = options.now ?? new Date();

  return Promise.all(
    listSources().map(async (source) => {
      const observation = await observeSourceRuntime(source.id, store);
      return buildSourceRuntimeState(source, observation, {
        environment: options.environment,
        now,
      });
    }),
  );
}

/**
 * Runtime health alone is never a clinical or credentialing verdict. A source
 * may be presented as clear only when the source is currently live AND the
 * persisted, explicit source outcome is `clear`.
 */
export function canPresentSourceOutcomeAsClear(
  runtime: Pick<SourceRuntimeState, 'isLive'>,
  outcome: SourceOutcomeState,
): boolean {
  return runtime.isLive && outcome === 'clear';
}

export function canPresentSourceAsLive(
  runtime: Pick<SourceRuntimeState, 'isLive'>,
): boolean {
  return runtime.isLive;
}
