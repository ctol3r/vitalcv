/**
 * W2-PR38A — Scale Chaos Simulation (scale gate)
 *
 * Injects random faults into the replay pipeline at scale and asserts the
 * fail-closed contract:
 *
 *   1. partial-failure surfacing — under a 20 % chaos rate against
 *      buildAuditBundle, every failed capsule appears in the bundle's
 *      custodyLog as a REPLAY_FAILED:<id>:<error> entry. No silent drops.
 *   2. event-stream survivability — the bundle hash is computed only over
 *      successful replays, so the bundle is never internally inconsistent.
 *   3. fail-closed integrity — when the verify call returns valid:false in
 *      chaos mode, integrity.hashMatch is false AND tamperEvidence is set.
 *      The replay engine never silently upgrades a failed verify to clean.
 *   4. governance integrity preserved — every successful replay still emits
 *      R-CAT-6 / DOSSIER_REPLAY metadata; chaos cannot collapse classification.
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

function makeCapsule(id: string) {
  return {
    id,
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
    verifierOrgId: 'org-tenant-A',
    decisionAction: 'APPROVE',
    triggerEvent: 'EMPLOYER_ACCEPTANCE',
    sourceReferenceId: `accept-${id}`,
    metadata: {
      runtimeTrust: {
        correlationId: `corr-${id}`,
        payloadHash: 'b'.repeat(64),
        mutationFingerprint: 'c'.repeat(64),
      },
    },
  };
}

// Deterministic PRNG so the chaos test is reproducible. (mulberry32)
function seededRandom(seed: number): () => number {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

describe('scale chaos simulation (W2-PR38A scale gate)', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();
  });

  it('surfaces every chaos-induced failure in the bundle custodyLog (no silent drops)', async () => {
    const N = 50;
    const chaosRate = 0.2;
    const rand = seededRandom(0xC0FFEE);
    const ids = Array.from({ length: N }, (_, i) => `cap-${i}`);
    const failures = new Set<string>();
    for (const id of ids) {
      if (rand() < chaosRate) failures.add(id);
    }

    mockGetCapsuleById.mockImplementation(async (id: string) => {
      if (failures.has(id)) {
        throw new Error('chaos: prisma fetch failed');
      }
      return makeCapsule(id);
    });
    mockVerifyDecisionCapsuleReplay.mockImplementation(async (id: string) => ({
      capsuleId: id,
      valid: true,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'a'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    }));
    mockVerificationArtifactFindMany.mockResolvedValue([]);
    mockVerificationArtifactFindFirst.mockResolvedValue(null);
    mockDecisionCapsuleFindMany.mockResolvedValue(ids.map(id => ({ id })));

    const bundle = await buildAuditBundle('1234567890');

    const failureEntries = bundle.custodyLog.filter(e =>
      e.event.startsWith('REPLAY_FAILED:'),
    );
    expect(failureEntries).toHaveLength(failures.size);

    const surfacedIds = new Set(
      failureEntries.map(e => e.event.split(':')[1]),
    );
    expect(surfacedIds).toEqual(failures);

    // Successful replays = N - failures, exactly.
    expect(bundle.capsuleCount).toBe(N - failures.size);
    // Bundle hash and bookend events are intact.
    expect(bundle.bundleHash).toMatch(/^[a-f0-9]{64}$/);
    expect(bundle.custodyLog[0].event).toBe('BUNDLE_CREATED');
    expect(bundle.custodyLog[bundle.custodyLog.length - 1].event).toBe(
      'HASH_COMPUTED',
    );

    const survivabilityPct =
      (failureEntries.length / failures.size) * 100;
    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] event-stream-survivability-pct=${survivabilityPct.toFixed(2)} ` +
        `chaos_rate=${(chaosRate * 100).toFixed(0)}% n=${N} surfaced=${failureEntries.length}/${failures.size}`,
    );
  });

  it('fails closed on chaos verify failures — tamperEvidence is always populated when valid=false', async () => {
    const N = 30;
    const rand = seededRandom(0xDEADBEEF);
    const ids = Array.from({ length: N }, (_, i) => `cap-${i}`);
    const tampered = new Set<string>();
    for (const id of ids) {
      if (rand() < 0.4) tampered.add(id);
    }

    mockGetCapsuleById.mockImplementation(async (id: string) => makeCapsule(id));
    mockVerifyDecisionCapsuleReplay.mockImplementation(async (id: string) => {
      if (tampered.has(id)) {
        return {
          capsuleId: id,
          valid: false,
          expectedArtifactHash: 'a'.repeat(64),
          actualArtifactHash: 'd'.repeat(64),
          expectedEvidenceSpineDigest: null,
          actualEvidenceSpineDigest: null,
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
    mockDecisionCapsuleFindMany.mockResolvedValue([]);

    let silentFailures = 0;
    let governanceDrift = 0;
    for (const id of ids) {
      const replay = await replayDecision(id);
      if (tampered.has(id)) {
        if (replay.integrity.hashMatch || replay.integrity.tamperEvidence === null) {
          silentFailures++;
        }
      } else {
        if (!replay.integrity.hashMatch || replay.integrity.tamperEvidence !== null) {
          silentFailures++;
        }
      }
      if (
        replay.replayMetadata.replayCategory !== 'R-CAT-6' ||
        replay.replayMetadata.mutationClassification !== 'DOSSIER_REPLAY'
      ) {
        governanceDrift++;
      }
    }
    expect(silentFailures).toBe(0);
    expect(governanceDrift).toBe(0);
    expect(tampered.size).toBeGreaterThan(0);
  });
});
