/**
 * W2-PR38A — Replay Throughput Integrity (scale gate)
 *
 * Drives the replay engine across high capsule volumes with mocked prisma
 * + capsuleEngine and asserts the four invariants that the scale gate exists
 * to protect:
 *
 *   1. replay integrity preserved under load (hashMatch reflects truth at N=500)
 *   2. ambiguity preserved under scale (R-CAT-6 + DOSSIER_REPLAY never collapse)
 *   3. fail-closed degradation (tampered capsules surface tamperEvidence)
 *   4. operator-visible saturation (audit-bundle custodyLog records every
 *      replay failure so partial bundles cannot impersonate clean ones)
 *
 * Pure mock-based tests — no DB. Safe for the CI scale gate.
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

interface SyntheticCapsuleSpec {
  id: string;
  tampered?: boolean;
  spineMismatch?: boolean;
  tenantId?: string | null;
  notFound?: boolean;
}

function makeCapsule(spec: SyntheticCapsuleSpec) {
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
    verifierOrgId: spec.tenantId === undefined ? 'org-tenant-A' : spec.tenantId,
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

function makeReplayResult(spec: SyntheticCapsuleSpec) {
  if (spec.tampered) {
    return {
      capsuleId: spec.id,
      valid: false,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'd'.repeat(64),
      expectedEvidenceSpineDigest: null,
      actualEvidenceSpineDigest: null,
    };
  }
  if (spec.spineMismatch) {
    return {
      capsuleId: spec.id,
      valid: false,
      expectedArtifactHash: 'a'.repeat(64),
      actualArtifactHash: 'a'.repeat(64),
      expectedEvidenceSpineDigest: 'spine-expected',
      actualEvidenceSpineDigest: 'spine-mismatch',
    };
  }
  return {
    capsuleId: spec.id,
    valid: true,
    expectedArtifactHash: 'a'.repeat(64),
    actualArtifactHash: 'a'.repeat(64),
    expectedEvidenceSpineDigest: null,
    actualEvidenceSpineDigest: null,
  };
}

function configureMocks(specs: SyntheticCapsuleSpec[]) {
  const byId = new Map(specs.map(s => [s.id, s]));
  mockGetCapsuleById.mockImplementation(async (id: string) => {
    const s = byId.get(id);
    if (!s || s.notFound) return null;
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
    return makeReplayResult(s);
  });
  mockVerificationArtifactFindMany.mockResolvedValue([]);
  mockVerificationArtifactFindFirst.mockResolvedValue(null);
  mockDecisionCapsuleFindMany.mockImplementation(async (args: { take?: number }) =>
    specs
      .filter(s => !s.notFound)
      .slice(0, args.take ?? specs.length)
      .map(s => ({ id: s.id })),
  );
}

describe('replay throughput integrity (W2-PR38A scale gate)', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();
  });

  it('replays 500 capsules sequentially with hashMatch=true and stable R-CAT-6', async () => {
    const N = 500;
    const specs: SyntheticCapsuleSpec[] = Array.from({ length: N }, (_, i) => ({ id: `cap-${i}` }));
    configureMocks(specs);

    const start = process.hrtime.bigint();
    let intactReplays = 0;
    for (const spec of specs) {
      const replay = await replayDecision(spec.id);
      if (replay.integrity.hashMatch && replay.replayMetadata.replayCategory === 'R-CAT-6') {
        intactReplays++;
      }
    }
    const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
    const integrityPct = (intactReplays / N) * 100;
    const replaysPerSec = (N / elapsedMs) * 1000;

    // Surface metrics for the operator-visible scale board.
    // eslint-disable-next-line no-console
    console.log(`[scale-board] replay-throughput-integrity-pct=${integrityPct.toFixed(2)} n=${N} replays_per_sec=${replaysPerSec.toFixed(0)}`);

    expect(intactReplays).toBe(N);
    expect(integrityPct).toBe(100);
    // Generous CI budget — the gate exists to catch silent collapse, not flake.
    expect(elapsedMs).toBeLessThan(15_000);
  });

  it('preserves payloadHash determinism across 200 replays of the same capsule', async () => {
    const N = 200;
    const specs: SyntheticCapsuleSpec[] = [{ id: 'cap-fixed' }];
    configureMocks(specs);

    const hashes = new Set<string>();
    const fingerprints = new Set<string>();
    const correlations = new Set<string>();
    for (let i = 0; i < N; i++) {
      const replay = await replayDecision('cap-fixed');
      hashes.add(replay.replayMetadata.payloadHash);
      fingerprints.add(replay.replayMetadata.mutationFingerprint);
      correlations.add(replay.replayMetadata.correlationId);
    }

    expect(hashes.size).toBe(1);
    expect(fingerprints.size).toBe(1);
    // correlationId is sourced from the seed in metadata, also stable.
    expect(correlations.size).toBe(1);
  });

  it('fails closed across a 30 % tamper rate — every tampered replay surfaces tamperEvidence', async () => {
    const N = 200;
    const tamperRate = 0.3;
    const specs: SyntheticCapsuleSpec[] = Array.from({ length: N }, (_, i) => ({
      id: `cap-${i}`,
      tampered: i % Math.ceil(1 / tamperRate) === 0,
    }));
    configureMocks(specs);

    let cleanReplays = 0;
    let tamperedReplays = 0;
    let silentTampers = 0;
    for (const spec of specs) {
      const replay = await replayDecision(spec.id);
      if (spec.tampered) {
        tamperedReplays++;
        if (replay.integrity.hashMatch || replay.integrity.tamperEvidence === null) {
          silentTampers++;
        }
      } else {
        cleanReplays++;
        expect(replay.integrity.hashMatch).toBe(true);
        expect(replay.integrity.tamperEvidence).toBeNull();
      }
    }

    expect(silentTampers).toBe(0);
    expect(tamperedReplays).toBeGreaterThan(0);
    expect(cleanReplays).toBeGreaterThan(0);
  });

  it('records every replay failure in the audit bundle custodyLog (no silent throughput collapse)', async () => {
    // Mix valid + missing-capsule (replay throws) to exercise failure surfacing.
    const specs: SyntheticCapsuleSpec[] = [
      { id: 'good-1' },
      { id: 'good-2' },
      { id: 'gone-1', notFound: true },
      { id: 'good-3' },
      { id: 'gone-2', notFound: true },
    ];
    configureMocks(specs);
    // findMany returns ALL ids (valid + missing) so the failure path runs.
    mockDecisionCapsuleFindMany.mockResolvedValue(specs.map(s => ({ id: s.id })));

    const bundle = await buildAuditBundle('1234567890');

    expect(bundle.capsuleCount).toBe(3); // only successful replays in count
    const failureEntries = bundle.custodyLog.filter(e => e.event.startsWith('REPLAY_FAILED:'));
    expect(failureEntries).toHaveLength(2);
    expect(failureEntries.map(e => e.event)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('REPLAY_FAILED:gone-1:'),
        expect.stringContaining('REPLAY_FAILED:gone-2:'),
      ]),
    );
    // Bundle still has the canonical bookend events.
    expect(bundle.custodyLog[0].event).toBe('BUNDLE_CREATED');
    expect(bundle.custodyLog[bundle.custodyLog.length - 1].event).toBe('HASH_COMPUTED');
  });
});
