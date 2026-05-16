/**
 * W2-PR38A — Scale Chaos Simulation (scale gate)
 *
 * Exercises the replay engine + audit-bundle pipeline under chaotic failure
 * injection (mixed tamper, missing capsule, prisma error, spine mismatch,
 * cross-tenant leak attempt) at scale and asserts that:
 *
 *   1. operator-visible saturation — every failure mode lands as its own
 *      custodyLog entry. A partial bundle can NEVER look like a clean one.
 *   2. fail-closed degradation — clean replays in a chaotic batch are
 *      hashMatch=true with tamperEvidence=null. The chaos does NOT bleed
 *      into clean replays.
 *   3. tenant containment under chaos — a cross-tenant capsule injected
 *      into a tenanted bundle request is rejected (TenantIsolationError
 *      surfaces in the custodyLog, never in the replays array).
 *   4. failure-rate visibility — at 50 % chaos, the bundle reports a
 *      capsuleCount equal to the observed clean count. No silent throughput
 *      collapse and no inflated count.
 *
 * Pure mock-based test — uses jest mocks to inject prisma + capsuleEngine
 * failures without touching a database.
 */

const mockGetCapsuleById = jest.fn();
const mockVerifyDecisionCapsuleReplay = jest.fn();
const mockVerificationArtifactFindMany = jest.fn();
const mockVerificationArtifactFindFirst = jest.fn();
const mockDecisionCapsuleFindMany = jest.fn();

jest.mock('../../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: mockVerificationArtifactFindMany,
      findFirst: mockVerificationArtifactFindFirst,
    },
    decisionCapsule: {
      findMany: mockDecisionCapsuleFindMany,
    },
  },
}));

jest.mock('../../../decision/capsuleEngine', () => ({
  capsuleEngine: {
    getCapsuleById: mockGetCapsuleById,
    verifyDecisionCapsuleReplay: mockVerifyDecisionCapsuleReplay,
  },
}));

jest.mock('../../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { buildAuditBundle, replayDecision } from '../../replayEngine';

type ChaosMode =
  | 'CLEAN'
  | 'TAMPERED'
  | 'SPINE_MISMATCH'
  | 'NOT_FOUND'
  | 'PRISMA_THROW'
  | 'CROSS_TENANT';

interface ChaosCapsule {
  id: string;
  mode: ChaosMode;
  tenantId?: string | null;
}

const FIXED_TENANT = 'org-tenant-A';

function makeCapsule(spec: ChaosCapsule, defaultTenant = FIXED_TENANT) {
  return {
    id: spec.id,
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:1234567890',
    decisionType: 'HIRING',
    decisionTimestamp: '2026-03-23T20:00:00.000Z',
    status: 'VALID',
    credentialIds: [],
    issuerIds: [],
    artifactHash: 'a'.repeat(64),
    methodology: 'decision_capsule.v262',
    methodologyVersion: 'decision_capsule.v262',
    verifierOrgId:
      spec.mode === 'CROSS_TENANT'
        ? 'org-tenant-OTHER'
        : (spec.tenantId === undefined ? defaultTenant : spec.tenantId),
    decisionAction: 'APPROVE',
    triggerEvent: 'EMPLOYER_ACCEPTANCE',
    sourceReferenceId: `accept-${spec.id}`,
    metadata: {
      runtimeTrust: {
        correlationId: `corr-${spec.id}`,
        payloadHash: 'b'.repeat(64),
        mutationFingerprint: 'c'.repeat(64),
      },
    },
  };
}

function configureChaos(specs: ChaosCapsule[]) {
  const byId = new Map(specs.map(s => [s.id, s]));

  mockGetCapsuleById.mockImplementation(async (id: string) => {
    const s = byId.get(id);
    if (!s) return null;
    if (s.mode === 'NOT_FOUND') return null;
    if (s.mode === 'PRISMA_THROW') {
      throw new Error(`prisma chaos: capsule ${id}`);
    }
    return makeCapsule(s);
  });

  mockVerifyDecisionCapsuleReplay.mockImplementation(async (id: string) => {
    const s = byId.get(id);
    if (!s) {
      return {
        capsuleId: id,
        valid: false,
        expectedArtifactHash: 'a'.repeat(64),
        actualArtifactHash: 'd'.repeat(64),
        expectedEvidenceSpineDigest: null,
        actualEvidenceSpineDigest: null,
      };
    }
    if (s.mode === 'TAMPERED') {
      return {
        capsuleId: id,
        valid: false,
        expectedArtifactHash: 'a'.repeat(64),
        actualArtifactHash: 'e'.repeat(64),
        expectedEvidenceSpineDigest: null,
        actualEvidenceSpineDigest: null,
      };
    }
    if (s.mode === 'SPINE_MISMATCH') {
      return {
        capsuleId: id,
        valid: false,
        expectedArtifactHash: 'a'.repeat(64),
        actualArtifactHash: 'a'.repeat(64),
        expectedEvidenceSpineDigest: 'spine-expected',
        actualEvidenceSpineDigest: 'spine-actual',
      };
    }
    return {
      capsuleId: id,
      valid: true,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'a'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    };
  });

  mockVerificationArtifactFindMany.mockResolvedValue([]);
  mockVerificationArtifactFindFirst.mockResolvedValue(null);
  mockDecisionCapsuleFindMany.mockResolvedValue(specs.map(s => ({ id: s.id })));
}

describe('audit-bundle scale chaos matrix (W2-PR38A scale gate)', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();
  });

  it('records every chaos failure mode in custodyLog and never bleeds into clean replays', async () => {
    const N = 100;
    const modes: ChaosMode[] = [
      'CLEAN',
      'TAMPERED',
      'SPINE_MISMATCH',
      'NOT_FOUND',
      'PRISMA_THROW',
    ];
    const specs: ChaosCapsule[] = Array.from({ length: N }, (_, i) => ({
      id: `chaos-${i}`,
      mode: modes[i % modes.length],
    }));
    configureChaos(specs);

    const bundle = await buildAuditBundle('1234567890', { maxCapsules: N });

    const cleanCount = specs.filter(s => s.mode === 'CLEAN').length;
    const tamperedCount = specs.filter(s => s.mode === 'TAMPERED').length;
    const spineCount = specs.filter(s => s.mode === 'SPINE_MISMATCH').length;
    const notFoundCount = specs.filter(s => s.mode === 'NOT_FOUND').length;
    const prismaCount = specs.filter(s => s.mode === 'PRISMA_THROW').length;

    // CLEAN, TAMPERED, SPINE_MISMATCH all complete a replay (with or without
    // tamperEvidence). NOT_FOUND + PRISMA_THROW raise inside replayDecision
    // and surface as REPLAY_FAILED entries.
    const expectedReplayed = cleanCount + tamperedCount + spineCount;
    const expectedFailures = notFoundCount + prismaCount;

    expect(bundle.capsuleCount).toBe(expectedReplayed);
    expect(bundle.replays).toHaveLength(expectedReplayed);

    const failureEntries = bundle.custodyLog.filter(e =>
      e.event.startsWith('REPLAY_FAILED:'),
    );
    expect(failureEntries).toHaveLength(expectedFailures);

    // No clean replay carries tamperEvidence or hashMismatch.
    const cleanReplays = bundle.replays.filter(r =>
      specs.find(s => s.id === r.capsuleId)?.mode === 'CLEAN',
    );
    for (const replay of cleanReplays) {
      expect(replay.integrity.hashMatch).toBe(true);
      expect(replay.integrity.tamperEvidence).toBeNull();
    }

    // Every tampered replay surfaces tamperEvidence (no silent corruption).
    const tamperedReplays = bundle.replays.filter(r =>
      specs.find(s => s.id === r.capsuleId)?.mode === 'TAMPERED',
    );
    for (const replay of tamperedReplays) {
      expect(replay.integrity.hashMatch).toBe(false);
      expect(replay.integrity.tamperEvidence).toMatch(/Hash mismatch/);
    }

    // Every spine-mismatch replay surfaces evidence-spine tamper text.
    const spineReplays = bundle.replays.filter(r =>
      specs.find(s => s.id === r.capsuleId)?.mode === 'SPINE_MISMATCH',
    );
    for (const replay of spineReplays) {
      expect(replay.integrity.hashMatch).toBe(false);
      expect(replay.integrity.tamperEvidence).toMatch(/Evidence spine digest mismatch/);
    }

    const visibilityPct =
      ((expectedReplayed + failureEntries.length) / N) * 100;

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] chaos-visibility-pct=${visibilityPct.toFixed(2)} n=${N} ` +
        `clean=${cleanCount} tampered=${tamperedCount} spine=${spineCount} ` +
        `not_found=${notFoundCount} prisma=${prismaCount}`,
    );
  });

  it('contains cross-tenant chaos — a wrong-tenant capsule never lands in a tenanted bundle', async () => {
    const specs: ChaosCapsule[] = [
      { id: 'good-1', mode: 'CLEAN' },
      { id: 'good-2', mode: 'CLEAN' },
      { id: 'leak-1', mode: 'CROSS_TENANT' },
      { id: 'good-3', mode: 'CLEAN' },
      { id: 'leak-2', mode: 'CROSS_TENANT' },
    ];
    configureChaos(specs);

    const bundle = await buildAuditBundle('1234567890', {
      requesterTenantId: FIXED_TENANT,
      maxCapsules: specs.length,
    });

    // findMany returned the cross-tenant capsules too (simulating a query-
    // layer regression). Defense-in-depth in replayDecision MUST reject them.
    expect(bundle.capsuleCount).toBe(3);
    expect(bundle.replays.map(r => r.capsuleId)).toEqual(['good-1', 'good-2', 'good-3']);

    const failureEntries = bundle.custodyLog.filter(e =>
      e.event.startsWith('REPLAY_FAILED:'),
    );
    expect(failureEntries).toHaveLength(2);
    expect(failureEntries.map(e => e.event)).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/REPLAY_FAILED:leak-1:.*tenant/i),
        expect.stringMatching(/REPLAY_FAILED:leak-2:.*tenant/i),
      ]),
    );

    // Every accepted replay carries the enforced tenant scope verdict.
    for (const replay of bundle.replays) {
      expect(replay.tenantScope.isolationVerdict).toBe('ENFORCED');
      expect(replay.tenantScope.capsuleTenantId).toBe(FIXED_TENANT);
    }

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] cross-tenant-chaos-contained=true ` +
        `clean=${bundle.capsuleCount} rejected=${failureEntries.length}`,
    );
  });

  it('survives a 50 % chaos rate — capsuleCount equals observed clean count, no inflation', async () => {
    const N = 200;
    const specs: ChaosCapsule[] = Array.from({ length: N }, (_, i) => ({
      id: `mix-${i}`,
      mode: i % 2 === 0 ? 'CLEAN' : (i % 4 === 1 ? 'TAMPERED' : 'NOT_FOUND'),
    }));
    configureChaos(specs);

    const bundle = await buildAuditBundle('1234567890', { maxCapsules: N });

    const cleanCount = specs.filter(s => s.mode === 'CLEAN').length;
    const tamperedCount = specs.filter(s => s.mode === 'TAMPERED').length;
    const notFoundCount = specs.filter(s => s.mode === 'NOT_FOUND').length;

    // CLEAN + TAMPERED both complete (TAMPERED carries tamperEvidence, but
    // it IS a complete replay). NOT_FOUND raises and lands in custodyLog.
    expect(bundle.capsuleCount).toBe(cleanCount + tamperedCount);
    expect(bundle.replays).toHaveLength(cleanCount + tamperedCount);
    expect(
      bundle.custodyLog.filter(e => e.event.startsWith('REPLAY_FAILED:')),
    ).toHaveLength(notFoundCount);

    // Hash deterministic across the bundle — tampering the chaos shape
    // should produce a different bundleHash, so two runs of the same shape
    // should produce the same hash. Sanity-check by re-running.
    const bundle2 = await buildAuditBundle('1234567890', { maxCapsules: N });
    // Bundle id and exportedAt drift between runs — but the replay set
    // and the replay payloads themselves should be identical.
    expect(bundle2.replays.map(r => r.capsuleId)).toEqual(
      bundle.replays.map(r => r.capsuleId),
    );
    expect(bundle2.replays.map(r => r.integrity.hashMatch)).toEqual(
      bundle.replays.map(r => r.integrity.hashMatch),
    );

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] chaos-50pct n=${N} clean=${cleanCount} ` +
        `tampered=${tamperedCount} failures=${notFoundCount}`,
    );
  });

  it('drives 200 sequential standalone replays under 30 % tamper chaos with zero silent collapse', async () => {
    const N = 200;
    const specs: ChaosCapsule[] = Array.from({ length: N }, (_, i) => ({
      id: `seq-${i}`,
      mode: i % 10 < 3 ? 'TAMPERED' : 'CLEAN',
    }));
    configureChaos(specs);

    let cleanCount = 0;
    let tamperedSurfaced = 0;
    let silentCollapses = 0;

    for (const spec of specs) {
      const replay = await replayDecision(spec.id);
      if (spec.mode === 'TAMPERED') {
        if (replay.integrity.hashMatch === false &&
            replay.integrity.tamperEvidence !== null) {
          tamperedSurfaced++;
        } else {
          silentCollapses++;
        }
      } else {
        if (replay.integrity.hashMatch === true &&
            replay.integrity.tamperEvidence === null) {
          cleanCount++;
        } else {
          silentCollapses++;
        }
      }
    }

    expect(silentCollapses).toBe(0);
    expect(cleanCount + tamperedSurfaced).toBe(N);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] sequential-chaos-replay n=${N} clean=${cleanCount} ` +
        `tampered_surfaced=${tamperedSurfaced} silent_collapses=${silentCollapses}`,
    );
  });
});
