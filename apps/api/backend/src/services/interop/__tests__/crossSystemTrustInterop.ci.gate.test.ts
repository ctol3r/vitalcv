/**
 * Cross-System Trust Interoperability — CI Gate (W2-PR87A)
 *
 * Canary suite. Every public primitive must:
 *   - throw TrustInteropError on boundary breaches (not silently allow);
 *   - export an enumerated `violation` field that matches the runtime sentinel;
 *   - never coerce AMBIGUOUS verdicts to CLEAN across the boundary;
 *   - produce deterministic, system-salted contract / bridge / sync digests.
 *
 * If a future refactor weakens any of these invariants, this suite breaks
 * the build before the regression ships.
 */

import {
  INTEROP_SENTINELS,
  KNOWN_INTEROP_TIERS,
  KNOWN_INTEROP_VIOLATIONS,
  KNOWN_SYNC_VERDICTS,
  TrustInteropError,
  adaptExternalLineage,
  assertContractCompatibility,
  assertCrossSystemAmbiguityPreserved,
  assertInteropBoundary,
  assertSyncVerdict,
  bridgeReplayInbound,
  bridgeReplayOutbound,
  computeInteropBoundary,
  declareTrustContract,
  synchronizeTrustState,
  type ReplayBridgeEnvelope,
  type SyncVerdict,
} from '../crossSystemTrustInterop';
import {
  quarantineReplay,
  type IntegritySignal,
} from '../../audit/replayCorruptionContainment';

const KNOWN_VIOLATIONS = [
  'UNDECLARED_SYSTEM',
  'CONTRACT_VERSION_DRIFT',
  'CONTRACT_FIELD_DRIFT',
  'BRIDGE_INTEGRITY_FAILURE',
  'AMBIGUITY_COLLAPSED_INBOUND',
  'AMBIGUITY_COLLAPSED_OUTBOUND',
  'LINEAGE_ADAPTER_MISMATCH',
  'SYNC_DIVERGENCE_FORCED_CONVERGENT',
  'SYNC_RECONSTRUCTION_FAILURE',
  'INTEROP_BLAST_RADIUS_BREACH',
] as const;

const KNOWN_VERDICTS: SyncVerdict[] = ['CONVERGED', 'DIVERGENT', 'INSUFFICIENT', 'AMBIGUOUS'];
const KNOWN_TIERS = ['SINGLE_SYSTEM', 'CROSS_CONTRACT', 'INTEROP_BLAST_RADIUS_BREACH'] as const;

const cleanIntegrity = (): IntegritySignal => ({
  hashMatch: true,
  storedHash: 'a'.repeat(64),
  recomputedHash: 'a'.repeat(64),
  tamperEvidence: null,
});

const ambiguousIntegrity = (): IntegritySignal => ({
  hashMatch: true,
  storedHash: 'a'.repeat(64),
  recomputedHash: 'a'.repeat(64),
  tamperEvidence: 'spurious tamper note',
});

describe('CI gate — exported enums match runtime sentinels', () => {
  it('every exported violation is in the runtime KNOWN_INTEROP_VIOLATIONS list', () => {
    for (const v of KNOWN_VIOLATIONS) {
      expect(KNOWN_INTEROP_VIOLATIONS).toContain(v);
    }
    expect(KNOWN_INTEROP_VIOLATIONS).toHaveLength(KNOWN_VIOLATIONS.length);
  });

  it('every exported sync verdict is in KNOWN_SYNC_VERDICTS', () => {
    for (const v of KNOWN_VERDICTS) expect(KNOWN_SYNC_VERDICTS).toContain(v);
    expect(KNOWN_SYNC_VERDICTS).toHaveLength(KNOWN_VERDICTS.length);
  });

  it('every exported interop tier is in KNOWN_INTEROP_TIERS', () => {
    for (const t of KNOWN_TIERS) expect(KNOWN_INTEROP_TIERS).toContain(t);
    expect(KNOWN_INTEROP_TIERS).toHaveLength(KNOWN_TIERS.length);
  });

  it('enums and sentinels are frozen', () => {
    expect(Object.isFrozen(KNOWN_INTEROP_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(KNOWN_SYNC_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_INTEROP_TIERS)).toBe(true);
    expect(Object.isFrozen(INTEROP_SENTINELS)).toBe(true);
  });
});

describe('CI gate — TrustInteropError contract', () => {
  it('every breach primitive throws a TrustInteropError with a known violation', () => {
    const localContract = declareTrustContract({
      contractId: 'ci-contract',
      systemId: 'ci-system',
      contractVersion: '1.0.0',
      inboundFields: ['v'],
      outboundFields: ['v'],
    });
    const local = quarantineReplay({ capsuleId: 'ci-cap', integrity: cleanIntegrity() });
    const env = bridgeReplayOutbound({
      bridgeId: 'ci-bridge',
      contract: localContract,
      fromSystem: 'vitalcv-prod',
      toSystem: 'ci-system',
      record: local,
    });

    const cases: Array<{ name: string; run: () => void; expected: typeof KNOWN_VIOLATIONS[number] }> = [
      {
        name: 'declareTrustContract empty systemId → UNDECLARED_SYSTEM',
        expected: 'UNDECLARED_SYSTEM',
        run: () => declareTrustContract({
          contractId: 'x', systemId: '', contractVersion: '1.0.0',
          inboundFields: [], outboundFields: [],
        }),
      },
      {
        name: 'declareTrustContract empty version → CONTRACT_VERSION_DRIFT',
        expected: 'CONTRACT_VERSION_DRIFT',
        run: () => declareTrustContract({
          contractId: 'x', systemId: 'sys', contractVersion: '',
          inboundFields: [], outboundFields: [],
        }),
      },
      {
        name: 'assertContractCompatibility version drift',
        expected: 'CONTRACT_VERSION_DRIFT',
        run: () => assertContractCompatibility(
          declareTrustContract({
            contractId: 'a', systemId: 's', contractVersion: '1.0.0',
            inboundFields: ['v'], outboundFields: ['v'],
          }),
          declareTrustContract({
            contractId: 'a', systemId: 's', contractVersion: '2.0.0',
            inboundFields: ['v'], outboundFields: ['v'],
          }),
        ),
      },
      {
        name: 'assertContractCompatibility field drift',
        expected: 'CONTRACT_FIELD_DRIFT',
        run: () => assertContractCompatibility(
          declareTrustContract({
            contractId: 'a', systemId: 's', contractVersion: '1.0.0',
            inboundFields: ['v'], outboundFields: ['v', 'extra'],
          }),
          declareTrustContract({
            contractId: 'a', systemId: 's', contractVersion: '1.0.0',
            inboundFields: ['v'], outboundFields: ['v'],
          }),
        ),
      },
      {
        name: 'bridgeReplayInbound forged digest → BRIDGE_INTEGRITY_FAILURE',
        expected: 'BRIDGE_INTEGRITY_FAILURE',
        run: () => bridgeReplayInbound({
          envelope: { ...env, direction: 'INBOUND', bridgeDigest: '0'.repeat(64) },
          contract: localContract,
        }),
      },
      {
        name: 'assertCrossSystemAmbiguityPreserved on a coerced envelope',
        expected: 'AMBIGUITY_COLLAPSED_INBOUND',
        run: () => assertCrossSystemAmbiguityPreserved({
          ...env,
          direction: 'INBOUND',
          replayRecord: { ...env.replayRecord, ambiguous: true, verdict: 'CLEAN', kind: null },
        }),
      },
      {
        name: 'adaptExternalLineage on schema drift',
        expected: 'CONTRACT_VERSION_DRIFT',
        run: () => adaptExternalLineage({
          contract: localContract,
          record: {
            externalCapsuleId: 'cap-1',
            externalSubjectId: '1234567890',
            externalSubjectIdScheme: 'npi',
            externalCredentialIds: [],
            externalSourceReferenceId: null,
            systemSchemaVersion: '99.0.0',
          },
        }),
      },
      {
        name: 'adaptExternalLineage missing capsule id',
        expected: 'LINEAGE_ADAPTER_MISMATCH',
        run: () => adaptExternalLineage({
          contract: localContract,
          record: {
            externalCapsuleId: '',
            externalSubjectId: '1234567890',
            externalSubjectIdScheme: 'npi',
            externalCredentialIds: [],
            externalSourceReferenceId: null,
            systemSchemaVersion: '1.0.0',
          },
        }),
      },
      {
        name: 'assertSyncVerdict divergence forced convergent',
        expected: 'SYNC_DIVERGENCE_FORCED_CONVERGENT',
        run: () => {
          const state = synchronizeTrustState({
            syncId: 's-x',
            subjectKey: 'k',
            snapshots: [
              { systemId: 'a', trustBand: 'GREEN',  capturedAt: null, sourceDigest: 'x' },
              { systemId: 'b', trustBand: 'YELLOW', capturedAt: null, sourceDigest: 'y' },
            ],
          });
          assertSyncVerdict(state, 'CONVERGED');
        },
      },
      {
        name: 'synchronizeTrustState empty subjectKey',
        expected: 'SYNC_RECONSTRUCTION_FAILURE',
        run: () => synchronizeTrustState({
          syncId: 's-x',
          subjectKey: '   ',
          snapshots: [],
        }),
      },
      {
        name: 'assertInteropBoundary on a breach',
        expected: 'INTEROP_BLAST_RADIUS_BREACH',
        run: () => {
          const boundary = computeInteropBoundary({ envelopes: [env], rejectedIds: ['rejected-1'] });
          assertInteropBoundary(boundary);
        },
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try { c.run(); } catch (e) { caught = e; }
      if (!(caught instanceof TrustInteropError)) {
        throw new Error(`case "${c.name}" did not throw a TrustInteropError; got: ${String(caught)}`);
      }
      const err = caught as TrustInteropError;
      expect(err.code).toBe('TRUST_INTEROP_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });
});

describe('CI gate — contract digest is deterministic and unique', () => {
  it('produces unique contractDigests for distinct (systemId, contractVersion) tuples', () => {
    const inputs = [
      { contractId: 'c-1', systemId: 'sys-A', contractVersion: '1.0.0', inboundFields: ['v'], outboundFields: ['v'] },
      { contractId: 'c-1', systemId: 'sys-A', contractVersion: '1.0.1', inboundFields: ['v'], outboundFields: ['v'] },
      { contractId: 'c-1', systemId: 'sys-B', contractVersion: '1.0.0', inboundFields: ['v'], outboundFields: ['v'] },
      { contractId: 'c-2', systemId: 'sys-A', contractVersion: '1.0.0', inboundFields: ['v'], outboundFields: ['v'] },
    ];
    const digests = inputs.map(i => declareTrustContract(i).contractDigest);
    expect(new Set(digests).size).toBe(inputs.length);
    // Reproducible: same input twice yields same digest.
    expect(declareTrustContract(inputs[0]).contractDigest).toBe(digests[0]);
  });
});

describe('CI gate — bridge envelopes never silently collapse ambiguity', () => {
  it('an AMBIGUOUS-input outbound envelope round-trips with verdict=AMBIGUOUS', () => {
    const contract = declareTrustContract({
      contractId: 'amb-contract',
      systemId: 'amb-system',
      contractVersion: '1.0.0',
      inboundFields: ['v'],
      outboundFields: ['v'],
    });
    const local = quarantineReplay({ capsuleId: 'amb-cap', integrity: ambiguousIntegrity() });
    expect(local.verdict).toBe('AMBIGUOUS');
    const env = bridgeReplayOutbound({
      bridgeId: 'amb-bridge',
      contract,
      fromSystem: 'vitalcv-prod',
      toSystem: 'amb-system',
      record: local,
    });
    expect(env.replayRecord.verdict).toBe('AMBIGUOUS');
    expect(env.replayRecord.ambiguous).toBe(true);
    expect(() => assertCrossSystemAmbiguityPreserved(env)).not.toThrow();

    const round = bridgeReplayInbound({ envelope: { ...env, direction: 'INBOUND' }, contract });
    expect(round.verdict).toBe('AMBIGUOUS');
    expect(round.ambiguous).toBe(true);
  });
});

describe('CI gate — sync reconstruction is order-independent', () => {
  it('reconstructionDigest matches across reordering of snapshot inputs', () => {
    const snapshots = [
      { systemId: 'epic',     trustBand: 'GREEN', capturedAt: null, sourceDigest: 'a' },
      { systemId: 'cerner',   trustBand: 'GREEN', capturedAt: null, sourceDigest: 'b' },
      { systemId: 'state-mb', trustBand: 'GREEN', capturedAt: null, sourceDigest: 'c' },
    ];
    const a = synchronizeTrustState({ syncId: 's', subjectKey: 'k', snapshots });
    const b = synchronizeTrustState({ syncId: 's', subjectKey: 'k', snapshots: [...snapshots].reverse() });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
  });
});
