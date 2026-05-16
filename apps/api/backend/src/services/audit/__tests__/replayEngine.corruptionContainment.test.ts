/**
 * replayEngine — corruption containment integration tests (W2-PR64A)
 *
 * Verifies the replay engine wires the corruption containment boundary:
 *   - every replay carries a containment record (CLEAN baseline included)
 *   - hash-mismatch / spine-drift replays surface as QUARANTINED, never CLEAN
 *   - ambiguity is preserved (hashMatch=false, no tamperEvidence) — verdict
 *     AMBIGUOUS, never coerced to CLEAN or QUARANTINED with a forced kind
 *   - bundle.containment.boundary tracks survivability across mixed chaos
 *   - bundle.containment.lineages enumerates contamination edges from each
 *     corrupt root through clean siblings sharing lineage hints
 *   - failed replays (NOT_FOUND, PRISMA_THROW) surface as quarantine records
 *     in the boundary (counted toward partial survivability), and as
 *     CONTAINMENT custody log entries in addition to the existing REPLAY_FAILED
 */

const mockGetCapsuleById = jest.fn();
const mockVerifyDecisionCapsuleReplay = jest.fn();
const mockVerificationArtifactFindMany = jest.fn();
const mockVerificationArtifactFindFirst = jest.fn();
const mockDecisionCapsuleFindMany = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
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

jest.mock('../../decision/capsuleEngine', () => ({
  capsuleEngine: {
    getCapsuleById: mockGetCapsuleById,
    verifyDecisionCapsuleReplay: mockVerifyDecisionCapsuleReplay,
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import { buildAuditBundle, replayDecision } from '../replayEngine';

// Engine-emitting modes. The engine's integrity.tamperEvidence is paired with
// `replayResult.valid` (always set when valid=false, always null when valid=true),
// so AMBIGUOUS_INTEGRITY is unreachable through the real engine pipeline. That
// path is exercised directly via the pure-module tests in
// replayCorruptionContainment.test.ts.
type Mode =
  | 'CLEAN'
  | 'TAMPERED'
  | 'SPINE_DRIFT'
  | 'NOT_FOUND'
  | 'PRISMA_THROW';

interface Spec {
  id: string;
  mode: Mode;
  subjectNpi?: string;
  credentialIds?: string[];
  sourceReferenceId?: string;
}

const FIXED_TENANT = 'org-tenant-A';

function makeCapsule(spec: Spec) {
  return {
    id: spec.id,
    subjectNpi: spec.subjectNpi ?? '1234567890',
    subjectDid: `did:vitalcv:${spec.subjectNpi ?? '1234567890'}`,
    decisionType: 'HIRING',
    decisionTimestamp: '2026-04-01T12:00:00.000Z',
    status: 'VALID',
    credentialIds: spec.credentialIds ?? [],
    issuerIds: [],
    artifactHash: 'a'.repeat(64),
    methodology: 'decision_capsule.v262',
    methodologyVersion: 'decision_capsule.v262',
    verifierOrgId: FIXED_TENANT,
    decisionAction: 'APPROVE',
    triggerEvent: 'EMPLOYER_ACCEPTANCE',
    sourceReferenceId: spec.sourceReferenceId ?? `accept-${spec.id}`,
    metadata: {
      runtimeTrust: {
        correlationId: `corr-${spec.id}`,
        payloadHash: 'b'.repeat(64),
        mutationFingerprint: 'c'.repeat(64),
      },
    },
  };
}

function configure(specs: Spec[]) {
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
        capsuleId: id, valid: false,
        expectedArtifactHash: 'a'.repeat(64),
        actualArtifactHash: 'd'.repeat(64),
        expectedEvidenceSpineDigest: null,
        actualEvidenceSpineDigest: null,
      };
    }
    switch (s.mode) {
      case 'TAMPERED':
        return {
          capsuleId: id, valid: false,
          expectedArtifactHash: 'a'.repeat(64),
          actualArtifactHash: 'e'.repeat(64),
          expectedEvidenceSpineDigest: null,
          actualEvidenceSpineDigest: null,
        };
      case 'SPINE_DRIFT':
        return {
          capsuleId: id, valid: false,
          expectedArtifactHash: 'a'.repeat(64),
          actualArtifactHash: 'a'.repeat(64),
          expectedEvidenceSpineDigest: 'spine-expected',
          actualEvidenceSpineDigest: 'spine-actual',
        };
      case 'CLEAN':
      default:
        return {
          capsuleId: id, valid: true,
          expectedArtifactHash: 'a'.repeat(64),
          actualArtifactHash: 'a'.repeat(64),
          expectedEvidenceSpineDigest: null,
          actualEvidenceSpineDigest: null,
        };
    }
  });

  mockVerificationArtifactFindMany.mockResolvedValue([]);
  mockVerificationArtifactFindFirst.mockResolvedValue(null);
  mockDecisionCapsuleFindMany.mockResolvedValue(specs.map(s => ({ id: s.id })));
}

describe('replayDecision — containment record', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();
  });

  it('CLEAN replay carries a CLEAN containment record', async () => {
    configure([{ id: 'cap-clean', mode: 'CLEAN' }]);
    const replay = await replayDecision('cap-clean');
    expect(replay.containment.verdict).toBe('CLEAN');
    expect(replay.containment.kind).toBeNull();
    expect(replay.containment.ambiguous).toBe(false);
    expect(replay.containment.containmentDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(replay.containment.lineageHints.subjectNpi).toBe('1234567890');
  });

  it('hash-mismatch replay quarantines as HASH_MISMATCH (never CLEAN)', async () => {
    configure([{ id: 'cap-tampered', mode: 'TAMPERED' }]);
    const replay = await replayDecision('cap-tampered');
    expect(replay.containment.verdict).toBe('QUARANTINED');
    expect(replay.containment.kind).toBe('HASH_MISMATCH');
    // The integrity check still surfaces tamperEvidence — containment
    // augments rather than replacing it.
    expect(replay.integrity.hashMatch).toBe(false);
    expect(replay.integrity.tamperEvidence).toMatch(/Hash mismatch/);
  });

  it('spine-drift replay quarantines as EVIDENCE_SPINE_DRIFT', async () => {
    configure([{ id: 'cap-spine', mode: 'SPINE_DRIFT' }]);
    const replay = await replayDecision('cap-spine');
    expect(replay.containment.verdict).toBe('QUARANTINED');
    expect(replay.containment.kind).toBe('EVIDENCE_SPINE_DRIFT');
    expect(replay.containment.reason).toMatch(/Evidence spine digest mismatch/);
  });

  it('lineage hints record subjectNpi, credentialIds, sourceReferenceId from capsule', async () => {
    configure([{
      id: 'cap-1',
      mode: 'TAMPERED',
      subjectNpi: '9999999999',
      credentialIds: ['art-A', 'art-B'],
      sourceReferenceId: 'ref-XYZ',
    }]);
    const replay = await replayDecision('cap-1');
    expect(replay.containment.lineageHints).toEqual({
      subjectNpi: '9999999999',
      credentialIds: ['art-A', 'art-B'],
      sourceReferenceId: 'ref-XYZ',
    });
  });
});

describe('buildAuditBundle — bundle-wide containment report', () => {
  beforeEach(() => {
    mockGetCapsuleById.mockReset();
    mockVerifyDecisionCapsuleReplay.mockReset();
    mockVerificationArtifactFindMany.mockReset();
    mockVerificationArtifactFindFirst.mockReset();
    mockDecisionCapsuleFindMany.mockReset();
  });

  it('CLEAN bundle reports 100% partial survivability and partitioned=true', async () => {
    configure([
      { id: 'cap-1', mode: 'CLEAN' },
      { id: 'cap-2', mode: 'CLEAN' },
      { id: 'cap-3', mode: 'CLEAN' },
    ]);
    const bundle = await buildAuditBundle('1234567890');
    expect(bundle.containment.boundary.partitioned).toBe(true);
    expect(bundle.containment.boundary.partialSurvivabilityPct).toBe(100);
    expect(bundle.containment.boundary.cleanCount).toBe(3);
    expect(bundle.containment.lineages).toHaveLength(0);
  });

  it('mixed bundle: clean siblings remain CLEAN — corruption does not bleed', async () => {
    configure([
      { id: 'cap-1', mode: 'CLEAN' },
      { id: 'cap-2', mode: 'TAMPERED' },
      { id: 'cap-3', mode: 'CLEAN' },
      { id: 'cap-4', mode: 'SPINE_DRIFT' },
    ]);
    const bundle = await buildAuditBundle('1234567890');

    const verdictsByCapsule = Object.fromEntries(
      bundle.replays.map(r => [r.capsuleId, r.containment.verdict]),
    );
    expect(verdictsByCapsule).toEqual({
      'cap-1': 'CLEAN',
      'cap-2': 'QUARANTINED',
      'cap-3': 'CLEAN',
      'cap-4': 'QUARANTINED',
    });

    expect(bundle.containment.boundary.cleanCount).toBe(2);
    expect(bundle.containment.boundary.quarantinedCount).toBe(2);
    expect(bundle.containment.boundary.partialSurvivabilityPct).toBe(100);
    expect(bundle.containment.boundary.partitioned).toBe(true);
  });

  it('lineage tracing — corrupt root links to clean siblings via shared subjectNpi', async () => {
    configure([
      { id: 'root-bad', mode: 'TAMPERED', subjectNpi: '1234567890' },
      { id: 'sibling-A', mode: 'CLEAN', subjectNpi: '1234567890' },
      { id: 'sibling-B', mode: 'CLEAN', subjectNpi: 'OTHER_NPI' },
    ]);
    const bundle = await buildAuditBundle('1234567890');

    expect(bundle.containment.lineages).toHaveLength(1);
    const lineage = bundle.containment.lineages[0];
    expect(lineage.rootCapsuleId).toBe('root-bad');
    expect(lineage.contaminatedCapsuleIds).toEqual(['sibling-A']);
    expect(lineage.edges[0].reason).toBe('SHARED_SUBJECT');
    // Sibling-B is on a different NPI → not contaminated.
    expect(lineage.contaminatedCapsuleIds).not.toContain('sibling-B');

    // Lineage detection must NOT mutate the sibling's verdict — the bundle
    // still reports it as CLEAN (lineage is a relationship, not a verdict).
    const siblingA = bundle.replays.find(r => r.capsuleId === 'sibling-A');
    expect(siblingA!.containment.verdict).toBe('CLEAN');
  });

  it('failed replay (NOT_FOUND) surfaces as a quarantine record AND a REPLAY_FAILED custody entry', async () => {
    configure([
      { id: 'cap-clean', mode: 'CLEAN' },
      { id: 'cap-missing', mode: 'NOT_FOUND' },
    ]);
    const bundle = await buildAuditBundle('1234567890');

    // The clean replay completed; the failed replay was synthesized into a
    // quarantine record so the boundary covers all 2 inputs.
    expect(bundle.replays).toHaveLength(1);
    expect(bundle.containment.quarantines).toHaveLength(2);

    const failureQuarantine = bundle.containment.quarantines.find(
      q => q.capsuleId === 'cap-missing',
    );
    expect(failureQuarantine?.verdict).toBe('QUARANTINED');
    expect(failureQuarantine?.kind).toBe('STRUCTURAL_CORRUPTION');

    // Existing REPLAY_FAILED entry preserved + new CONTAINMENT entry added.
    const replayFailed = bundle.custodyLog.filter(e =>
      e.event.startsWith('REPLAY_FAILED:'),
    );
    expect(replayFailed).toHaveLength(1);
    const containmentLog = bundle.custodyLog.filter(e =>
      e.event.startsWith('CONTAINMENT_QUARANTINED:cap-missing:'),
    );
    expect(containmentLog).toHaveLength(1);

    expect(bundle.containment.boundary.partialSurvivabilityPct).toBe(100);
  });

  it('boundary digest is deterministic across reruns of the same chaos shape', async () => {
    const shape: Spec[] = [
      { id: 'cap-1', mode: 'CLEAN' },
      { id: 'cap-2', mode: 'TAMPERED' },
      { id: 'cap-3', mode: 'CLEAN' },
    ];
    configure(shape);
    const bundle1 = await buildAuditBundle('1234567890');

    configure(shape);
    const bundle2 = await buildAuditBundle('1234567890');

    expect(bundle1.containment.boundary.boundaryDigest)
      .toBe(bundle2.containment.boundary.boundaryDigest);
  });

  it('chaos at 30% — survivability >= 70%, lineage walks corrupt roots through siblings', async () => {
    const N = 30;
    const specs: Spec[] = Array.from({ length: N }, (_, i) => ({
      id: `cap-${i}`,
      mode: i % 10 < 3 ? 'TAMPERED' : 'CLEAN',
      subjectNpi: i < 15 ? '1234567890' : '0987654321',
    }));
    configure(specs);

    const bundle = await buildAuditBundle('1234567890', { maxCapsules: N });

    expect(bundle.containment.boundary.partialSurvivabilityPct).toBe(100);
    expect(bundle.containment.boundary.cleanCount).toBeGreaterThanOrEqual(N * 0.6);

    const tampered = specs.filter(s => s.mode === 'TAMPERED');
    expect(bundle.containment.lineages).toHaveLength(tampered.length);

    // Every lineage record carries a deterministic reconstruction digest.
    for (const lin of bundle.containment.lineages) {
      expect(lin.reconstructionDigest).toMatch(/^[a-f0-9]{64}$/);
    }

    // CONTAINMENT_BOUNDARY_INTACT custody entry exists.
    const boundaryEntry = bundle.custodyLog.find(e =>
      e.event.startsWith('CONTAINMENT_BOUNDARY_INTACT'),
    );
    expect(boundaryEntry).toBeDefined();
  });
});
