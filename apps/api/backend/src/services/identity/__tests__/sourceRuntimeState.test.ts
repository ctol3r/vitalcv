import { SourceRunStatus as SourceRunStatusEnum } from '@prisma/client';
import {
  buildPrismaSourceRuntimeStore,
  buildSourceRuntimeState,
  classifyLatestRunStatus,
  canPresentSourceAsLive,
  canPresentSourceOutcomeAsClear,
  type SourceOutcomeState,
  type SourceRuntimeObservation,
  type SourceRuntimeTruthState,
} from '../sourceRuntimeState';
import { getSource } from '../sourceCatalog';

const NOW = new Date('2026-07-31T08:00:00.000Z');
const CURRENT = new Date('2026-07-31T07:00:00.000Z');
const OLD = new Date('2025-01-01T00:00:00.000Z');

function observation(
  input: Partial<SourceRuntimeObservation> = {},
): SourceRuntimeObservation {
  return {
    latestRun: null,
    latestSuccessfulRun: null,
    latestArtifact: null,
    ...input,
  };
}

function successRun(at = CURRENT) {
  return {
    sourceId: 'NPPES_API',
    status: 'VERIFIED',
    createdAt: at,
    completedAt: at,
  };
}

function artifact(at = CURRENT) {
  return {
    id: 'artifact-1',
    source: 'NPPES_API',
    fetchedAt: at,
    observedAt: at,
  };
}

describe('source runtime truth matrix', () => {
  test.each<{
    label: string;
    sourceId: string;
    environment: NodeJS.ProcessEnv;
    observed: SourceRuntimeObservation;
    expected: SourceRuntimeTruthState;
  }>([
    {
      label: 'cataloged without canonical implementation',
      sourceId: 'CMS_NDF',
      environment: { CMS_NDF_ENABLED: 'true' },
      observed: observation(),
      expected: 'unavailable',
    },
    {
      label: 'disabled by runtime flag',
      sourceId: 'NPPES_API',
      environment: {},
      observed: observation(),
      expected: 'gated',
    },
    {
      label: 'enabled but credentials absent',
      sourceId: 'NURSYS',
      environment: { REAL_NURSYS_ENABLED: 'true' },
      observed: observation(),
      expected: 'access_required',
    },
    {
      label: 'latest run failed',
      sourceId: 'NPPES_API',
      environment: { NPPES_API_ENABLED: 'true' },
      observed: observation({
        latestRun: {
          sourceId: 'NPPES_API',
          status: 'FAILED',
          createdAt: CURRENT,
          completedAt: CURRENT,
        },
      }),
      expected: 'failed',
    },
    {
      label: 'latest run incomplete',
      sourceId: 'NPPES_API',
      environment: { NPPES_API_ENABLED: 'true' },
      observed: observation({
        latestRun: {
          sourceId: 'NPPES_API',
          status: 'FETCHING',
          createdAt: CURRENT,
          completedAt: null,
        },
      }),
      expected: 'partial',
    },
    {
      label: 'never successfully checked',
      sourceId: 'NPPES_API',
      environment: { NPPES_API_ENABLED: 'true' },
      observed: observation(),
      expected: 'not_checked',
    },
    {
      label: 'successful run without artifact',
      sourceId: 'NPPES_API',
      environment: { NPPES_API_ENABLED: 'true' },
      observed: observation({
        latestRun: successRun(),
        latestSuccessfulRun: successRun(),
      }),
      expected: 'partial',
    },
    {
      label: 'successful artifact outside freshness window',
      sourceId: 'NPPES_API',
      environment: { NPPES_API_ENABLED: 'true' },
      observed: observation({
        latestRun: successRun(OLD),
        latestSuccessfulRun: successRun(OLD),
        latestArtifact: artifact(OLD),
      }),
      expected: 'stale',
    },
    {
      label: 'successful fresh persisted run and artifact',
      sourceId: 'NPPES_API',
      environment: { NPPES_API_ENABLED: 'true' },
      observed: observation({
        latestRun: successRun(),
        latestSuccessfulRun: successRun(),
        latestArtifact: artifact(),
      }),
      expected: 'live',
    },
  ])('$label -> $expected', ({ sourceId, environment, observed, expected }) => {
    const source = getSource(sourceId);
    expect(source).not.toBeNull();
    const runtime = buildSourceRuntimeState(source!, observed, {
      environment,
      now: NOW,
    });
    expect(runtime.runtimeState).toBe(expected);
    expect(runtime.isLive).toBe(expected === 'live');
    expect(canPresentSourceAsLive(runtime)).toBe(expected === 'live');
  });

  test('only an explicit clear outcome on a live source may render clear', () => {
    const outcomes: SourceOutcomeState[] = [
      'clear',
      'positive',
      'possible_match',
      'not_listed',
      'not_checked',
      'unavailable',
      'access_required',
      'failed',
      'gated',
    ];

    for (const outcome of outcomes) {
      expect(
        canPresentSourceOutcomeAsClear({ isLive: false }, outcome),
      ).toBe(false);
      expect(
        canPresentSourceOutcomeAsClear({ isLive: true }, outcome),
      ).toBe(outcome === 'clear');
    }
  });
});

describe('the real Prisma store — the layer the injected fakes never reach', () => {
  /**
   * E0 returned 503 for every source on every request for its entire life.
   * `SUCCESS_RUN_STATUSES` contained 'SUCCESS' and 'COMPLETED', which are not
   * members of the `SourceRunStatus` enum, and Prisma validates `where.in`
   * against the enum before running the query. The error was caught and
   * reported as "source runtime state could not be computed".
   *
   * Every existing test in this file injects a store, so none of them ever
   * built a Prisma argument. These do.
   */
  const ENUM_MEMBERS = new Set(Object.keys(SourceRunStatusEnum));

  it('only filters on statuses the SourceRunStatus enum actually declares', async () => {
    const seen: unknown[] = [];
    const fakePrisma = {
      sourceRun: {
        findFirst: async (args: { where?: { status?: { in?: unknown[] } } }) => {
          if (args.where?.status?.in) seen.push(...args.where.status.in);
          return null;
        },
      },
      verificationArtifact: { findFirst: async () => null },
    };

    await buildPrismaSourceRuntimeStore(fakePrisma).findLatestSuccessfulRun('NPPES_API');

    expect(seen.length).toBeGreaterThan(0);
    for (const status of seen) {
      expect(ENUM_MEMBERS.has(String(status))).toBe(true);
    }
  });

  it('classifies only real enum members, and never invents one', () => {
    // Guards the other direction: a status the enum declares must classify to
    // something, and a value it does not declare must not be treated as success.
    for (const member of ENUM_MEMBERS) {
      expect(['success', 'failed', 'partial']).toContain(classifyLatestRunStatus(member));
    }
    expect(classifyLatestRunStatus('SUCCESS')).not.toBe('success');
    expect(classifyLatestRunStatus('COMPLETED')).not.toBe('success');
  });
});
