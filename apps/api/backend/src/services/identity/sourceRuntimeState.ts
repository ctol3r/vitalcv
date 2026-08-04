/**
 * sourceRuntimeState.ts — E0 source liveness truth contract.
 *
 * A catalog entry, adapter file or enabled flag is not proof that a source is
 * live. Source liveness requires one canonical adapter, configuration, access,
 * a successful persisted SourceRun and a fresh persisted artifact.
 */

import type { SourceRunStatus } from '@prisma/client';
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

/**
 * Run statuses, classified — and every member is checked against the generated
 * `SourceRunStatus` enum at compile time.
 *
 * These sets used to be bare `Set<string>` holding five values the enum has
 * never contained: `SUCCESS`, `COMPLETED`, `CANCELLED`, `PARSING`, `RUNNING`.
 * Four were merely dead, because they are only ever compared against a status
 * already read out of the database. `SUCCESS` and `COMPLETED` were not: they go
 * into `where.status.in`, and Prisma validates that argument against the enum
 * before it will run the query.
 *
 * So every call threw `PrismaClientValidationError: Invalid value for argument
 * 'in'. Expected SourceRunStatus`, was caught, and was returned as a 503 —
 * meaning E0 answered "source runtime state could not be computed" for every
 * source, on every request, for its entire life. Nothing caught it because the
 * unit tests inject a fake store and never build a real Prisma query, and the
 * tenant guard 401'd the route before anyone could see the 503 behind it.
 *
 * Typing them as `SourceRunStatus[]` is the actual fix. A future rename in
 * `schema.prisma` now fails `tsc` instead of failing silently in production.
 */
const SUCCESS_RUN_STATUSES: readonly SourceRunStatus[] = ['VERIFIED', 'ALERTED'];
const FAILED_RUN_STATUSES: readonly SourceRunStatus[] = ['FAILED', 'QUARANTINED'];
const PARTIAL_RUN_STATUSES: readonly SourceRunStatus[] = [
  'QUEUED',
  'FETCHING',
  'FETCHED',
  'PARSED',
  'NORMALIZED',
];

/**
 * The real store, over an injectable client.
 *
 * It used to close directly over the module-level `runtimePrisma`, so there was
 * no seam at which a test could observe the arguments it builds — and the
 * argument it built was invalid for E0's entire life. Taking the client as a
 * parameter is what makes the query itself assertable.
 */
export function buildPrismaSourceRuntimeStore(client: RuntimePrisma): SourceRuntimeStore {
  return {
  async findLatestRun(sourceId) {
    return client.sourceRun.findFirst({
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
    return client.sourceRun.findFirst({
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
    return client.verificationArtifact.findFirst({
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
}

export const prismaSourceRuntimeStore: SourceRuntimeStore =
  buildPrismaSourceRuntimeStore(runtimePrisma);

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

export function classifyLatestRunStatus(status: string | null): SourceLastRunStatus {
  if (!status) return 'never';
  const normalized = status.toUpperCase() as SourceRunStatus;
  if (SUCCESS_RUN_STATUSES.includes(normalized)) return 'success';
  if (FAILED_RUN_STATUSES.includes(normalized)) return 'failed';
  if (PARTIAL_RUN_STATUSES.includes(normalized)) return 'partial';
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
  const classifiedLatestRun = classifyLatestRunStatus(latestRunRawStatus);
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
