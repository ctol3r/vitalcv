/**
 * W2-PR38A — Latency Degradation Modeling (scale gate)
 *
 * Models p50 / p95 / p99 latency curves for replayDecision under simulated
 * slow underlying calls. The replay engine has no built-in timeout, so the
 * gate this test enforces is:
 *
 *   1. throughput does not silently collapse — replays still complete and
 *      produce intact metadata when prisma is slow;
 *   2. latency budget is operator-visible — we emit a [scale-board] line
 *      with p50/p95/p99 so dashboards have a stable signal to track;
 *   3. fail-closed degradation — at the budget ceiling we still get a
 *      well-formed DecisionReplay (or a thrown error). No half-formed bundles.
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

import { replayDecision } from '../../replayEngine';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function percentile(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

const baseCapsule = {
  id: 'capsule-latency',
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
  sourceReferenceId: 'accept-1',
  metadata: {
    runtimeTrust: {
      correlationId: 'corr-latency',
      payloadHash: 'b'.repeat(64),
      mutationFingerprint: 'c'.repeat(64),
    },
  },
};

describe('latency degradation modeling (W2-PR38A scale gate)', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();
  });

  it('models p50 / p95 / p99 under randomized prisma slowness without dropping replays', async () => {
    // Inject 2-25 ms of random latency on every prisma + capsuleEngine call.
    // Across 4 calls per replay this gives a synthetic underlying tail.
    const slowResolve = async <T>(value: T): Promise<T> => {
      const ms = 2 + Math.floor(Math.random() * 24);
      await delay(ms);
      return value;
    };
    mockGetCapsuleById.mockImplementation(() => slowResolve(baseCapsule));
    mockVerifyDecisionCapsuleReplay.mockImplementation(() =>
      slowResolve({
        capsuleId: baseCapsule.id,
        valid: true,
        expectedArtifactHash: 'a'.repeat(64),
        actualArtifactHash: 'a'.repeat(64),
        expectedEvidenceSpineDigest: null,
        actualEvidenceSpineDigest: null,
      }),
    );
    mockVerificationArtifactFindMany.mockImplementation(() => slowResolve([]));
    mockVerificationArtifactFindFirst.mockImplementation(() => slowResolve(null));
    mockDecisionCapsuleFindMany.mockImplementation(() => slowResolve([]));

    const N = 50;
    const samples: number[] = [];
    let intactReplays = 0;
    for (let i = 0; i < N; i++) {
      const start = process.hrtime.bigint();
      const replay = await replayDecision(baseCapsule.id);
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      samples.push(elapsedMs);
      if (replay.integrity.hashMatch && replay.replayMetadata.replayCategory === 'R-CAT-6') {
        intactReplays++;
      }
    }
    const p50 = percentile(samples, 50);
    const p95 = percentile(samples, 95);
    const p99 = percentile(samples, 99);
    const survivabilityPct = (intactReplays / N) * 100;

    // Survivability is the gate — under slowness, replays must still complete
    // intact (no silent partial output) — even though latency is degraded.
    expect(intactReplays).toBe(N);
    // Generous CI ceiling for the slowest run; we are watching for ORDER OF
    // MAGNITUDE collapse, not measuring real-world latency.
    expect(p99).toBeLessThan(2000);

    // eslint-disable-next-line no-console
    console.log(
      `[scale-board] latency-survivability-pct=${survivabilityPct.toFixed(2)} ` +
        `n=${N} p50_ms=${p50.toFixed(1)} p95_ms=${p95.toFixed(1)} p99_ms=${p99.toFixed(1)}`,
    );
  });

  it('fails closed when prisma throws — no half-formed replays', async () => {
    mockGetCapsuleById.mockImplementation(async () => {
      throw new Error('upstream prisma timeout');
    });

    await expect(replayDecision('capsule-latency')).rejects.toThrow(/upstream prisma timeout/);
  });

  it('fails closed when capsule is missing — never returns a degraded shape', async () => {
    mockGetCapsuleById.mockResolvedValue(null);
    await expect(replayDecision('does-not-exist')).rejects.toThrow(/Capsule not found/);
  });
});
