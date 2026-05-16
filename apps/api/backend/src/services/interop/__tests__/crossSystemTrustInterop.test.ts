/**
 * crossSystemTrustInterop — unit tests (W2-PR87A)
 *
 * Pure-transform module — no mocks, no DB. Verifies:
 *   - declareTrustContract produces deterministic, tamper-evident digests
 *   - assertContractCompatibility throws on every drift axis
 *   - bridgeReplayOutbound + bridgeReplayInbound round-trip cleanly
 *   - bridgeReplayInbound rejects forged digests (BRIDGE_INTEGRITY_FAILURE)
 *   - synchronizeTrustState reconstruction is order-independent
 *   - assertSyncVerdict refuses to coerce divergent → converged
 */

import {
  KNOWN_INTEROP_VIOLATIONS,
  KNOWN_SYNC_VERDICTS,
  KNOWN_INTEROP_TIERS,
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
  type TrustContract,
} from '../crossSystemTrustInterop';
import {
  evaluateContainment,
  quarantineReplay,
  type IntegritySignal,
  type ReplayQuarantineRecord,
} from '../../audit/replayCorruptionContainment';

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

const tamperedIntegrity = (): IntegritySignal => ({
  hashMatch: false,
  storedHash: 'a'.repeat(64),
  recomputedHash: 'b'.repeat(64),
  tamperEvidence: 'Hash mismatch',
});

function makeContract(overrides: Partial<Parameters<typeof declareTrustContract>[0]> = {}): TrustContract {
  return declareTrustContract({
    contractId: 'contract-vitalcv-x-epic',
    systemId: 'epic-prod-12345',
    contractVersion: '1.0.0',
    inboundFields: ['trustBand', 'capturedAt', 'sourceDigest', 'verdict'],
    outboundFields: ['trustBand', 'capturedAt', 'sourceDigest', 'verdict'],
    ...overrides,
  });
}

describe('declareTrustContract', () => {
  it('produces a deterministic contractDigest for identical inputs', () => {
    const a = makeContract();
    const b = makeContract();
    expect(a.contractDigest).toBe(b.contractDigest);
  });

  it('produces different digests for different versions', () => {
    const a = makeContract({ contractVersion: '1.0.0' });
    const b = makeContract({ contractVersion: '1.0.1' });
    expect(a.contractDigest).not.toBe(b.contractDigest);
  });

  it('rejects empty systemId / contractId / contractVersion as fail-closed', () => {
    expect(() => declareTrustContract({
      contractId: 'c-1', systemId: '   ', contractVersion: '1.0.0',
      inboundFields: [], outboundFields: [],
    })).toThrow(TrustInteropError);
    expect(() => declareTrustContract({
      contractId: '', systemId: 'epic', contractVersion: '1.0.0',
      inboundFields: [], outboundFields: [],
    })).toThrow(TrustInteropError);
    expect(() => declareTrustContract({
      contractId: 'c-1', systemId: 'epic', contractVersion: '',
      inboundFields: [], outboundFields: [],
    })).toThrow(TrustInteropError);
  });

  it('always sets failClosed=true and ambiguityPolicy=PRESERVE by default', () => {
    const c = makeContract();
    expect(c.failClosed).toBe(true);
    expect(c.ambiguityPolicy).toBe('PRESERVE');
  });

  it('dedupes and sorts inbound/outbound field lists', () => {
    const c = makeContract({
      inboundFields: ['z', 'a', 'a', 'm'],
      outboundFields: ['a', 'a'],
    });
    expect(c.inboundFields).toEqual(['a', 'm', 'z']);
    expect(c.outboundFields).toEqual(['a']);
  });
});

describe('assertContractCompatibility', () => {
  it('passes when both sides match exactly', () => {
    const a = makeContract();
    const b = makeContract();
    expect(() => assertContractCompatibility(a, b)).not.toThrow();
  });

  it('throws CONTRACT_VERSION_DRIFT when versions differ', () => {
    const a = makeContract({ contractVersion: '1.0.0' });
    const b = makeContract({ contractVersion: '1.0.1' });
    let caught: TrustInteropError | null = null;
    try { assertContractCompatibility(a, b); } catch (e) { caught = e as TrustInteropError; }
    expect(caught).toBeInstanceOf(TrustInteropError);
    expect(caught?.violation).toBe('CONTRACT_VERSION_DRIFT');
  });

  it('throws CONTRACT_FIELD_DRIFT when local outbound lacks remote inbound coverage', () => {
    const a = makeContract({ outboundFields: ['trustBand', 'capturedAt', 'sourceDigest', 'verdict', 'extraSecret'] });
    const b = makeContract();
    let caught: TrustInteropError | null = null;
    try { assertContractCompatibility(a, b); } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('CONTRACT_FIELD_DRIFT');
  });

  it('throws AMBIGUITY_COLLAPSED_OUTBOUND if either side declares REJECT', () => {
    const a = makeContract({ ambiguityPolicy: 'REJECT' });
    const b = makeContract();
    let caught: TrustInteropError | null = null;
    try { assertContractCompatibility(a, b); } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('AMBIGUITY_COLLAPSED_OUTBOUND');
  });
});

describe('replay bridge round-trip', () => {
  it('outbound → inbound preserves verdict and capsuleId', () => {
    const contract = makeContract();
    const local = quarantineReplay({ capsuleId: 'cap-x1', integrity: cleanIntegrity() });
    const env = bridgeReplayOutbound({
      bridgeId: 'b-001',
      contract,
      fromSystem: 'vitalcv-prod',
      toSystem: contract.systemId,
      record: local,
    });
    expect(env.replayRecord.verdict).toBe('CLEAN');
    expect(env.replayRecord.capsuleId).toBe('cap-x1');

    const inboundContract = makeContract();
    const round = bridgeReplayInbound({ envelope: { ...env, direction: 'INBOUND' }, contract: inboundContract });
    expect(round.verdict).toBe('CLEAN');
    expect(round.capsuleId).toBe('cap-x1');
  });

  it('preserves AMBIGUOUS across the boundary', () => {
    const contract = makeContract();
    const local = quarantineReplay({ capsuleId: 'cap-amb', integrity: ambiguousIntegrity() });
    expect(local.verdict).toBe('AMBIGUOUS');

    const env = bridgeReplayOutbound({
      bridgeId: 'b-002',
      contract,
      fromSystem: 'vitalcv-prod',
      toSystem: contract.systemId,
      record: local,
    });
    expect(env.replayRecord.verdict).toBe('AMBIGUOUS');
    expect(env.replayRecord.ambiguous).toBe(true);

    const round = bridgeReplayInbound({
      envelope: { ...env, direction: 'INBOUND' },
      contract: makeContract(),
    });
    expect(round.verdict).toBe('AMBIGUOUS');
    expect(round.ambiguous).toBe(true);
  });

  it('refuses to emit an ambiguous record under REJECT policy', () => {
    const contract = makeContract();
    const local = quarantineReplay({ capsuleId: 'cap-amb', integrity: ambiguousIntegrity() });
    // Synthesize a contract that violates the invariant — call site path.
    const rejectContract: TrustContract = { ...contract, ambiguityPolicy: 'REJECT' };
    let caught: TrustInteropError | null = null;
    try {
      bridgeReplayOutbound({
        bridgeId: 'b-003',
        contract: rejectContract,
        fromSystem: 'vitalcv-prod',
        toSystem: contract.systemId,
        record: local,
      });
    } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('AMBIGUITY_COLLAPSED_OUTBOUND');
  });

  it('rejects an inbound envelope with a forged bridgeDigest (BRIDGE_INTEGRITY_FAILURE)', () => {
    const contract = makeContract();
    const local = quarantineReplay({ capsuleId: 'cap-x2', integrity: cleanIntegrity() });
    const env = bridgeReplayOutbound({
      bridgeId: 'b-004',
      contract,
      fromSystem: 'vitalcv-prod',
      toSystem: contract.systemId,
      record: local,
    });
    const forged: ReplayBridgeEnvelope = {
      ...env,
      direction: 'INBOUND',
      bridgeDigest: '0'.repeat(64),
    };
    let caught: TrustInteropError | null = null;
    try { bridgeReplayInbound({ envelope: forged, contract }); } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('BRIDGE_INTEGRITY_FAILURE');
  });

  it('rejects an inbound envelope under contract version drift', () => {
    const contractA = makeContract({ contractVersion: '1.0.0' });
    const contractB = makeContract({ contractVersion: '2.0.0' });
    const local = quarantineReplay({ capsuleId: 'cap-x3', integrity: cleanIntegrity() });
    const env = bridgeReplayOutbound({
      bridgeId: 'b-005',
      contract: contractA,
      fromSystem: 'vitalcv-prod',
      toSystem: contractA.systemId,
      record: local,
    });
    let caught: TrustInteropError | null = null;
    try {
      bridgeReplayInbound({ envelope: { ...env, direction: 'INBOUND' }, contract: contractB });
    } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('CONTRACT_VERSION_DRIFT');
  });

  it('refuses an inbound envelope whose ambiguous flag contradicts its verdict (AMBIGUITY_COLLAPSED_INBOUND)', () => {
    const contract = makeContract();
    const local = quarantineReplay({ capsuleId: 'cap-x4', integrity: cleanIntegrity() });
    const env = bridgeReplayOutbound({
      bridgeId: 'b-006',
      contract,
      fromSystem: 'vitalcv-prod',
      toSystem: contract.systemId,
      record: local,
    });
    // Forge a hostile envelope: ambiguous=true, verdict=CLEAN.
    const hostileRecord = { ...env.replayRecord, ambiguous: true };
    const hostile: ReplayBridgeEnvelope = {
      ...env,
      direction: 'INBOUND',
      replayRecord: hostileRecord,
      // Re-sign so it would otherwise pass integrity.
      bridgeDigest: env.bridgeDigest,
    };
    // Recompute the digest the way an attacker WOULD if they were honest about the change.
    // We do that by going through a valid signer indirectly: build a tiny re-sign helper.
    const honestEnvelope: ReplayBridgeEnvelope = {
      ...hostile,
      bridgeDigest: ((): string => {
        // Use the public bridgeReplayOutbound path? No — that would refuse to emit.
        // So we build the digest using the same canonicalization the module uses.
        // The point of this test is the *semantic* assertion, so we sidestep
        // integrity by passing the envelope's stated digest through the
        // assertCrossSystemAmbiguityPreserved guard directly.
        return env.bridgeDigest;
      })(),
    };
    let caught: TrustInteropError | null = null;
    try { assertCrossSystemAmbiguityPreserved(honestEnvelope); } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('AMBIGUITY_COLLAPSED_INBOUND');
  });
});

describe('synchronizeTrustState', () => {
  it('is order-independent: same set in any order produces the same reconstructionDigest', () => {
    const snapshots = [
      { systemId: 'epic',       trustBand: 'GREEN', capturedAt: '2026-05-09T00:00:00Z', sourceDigest: 'a' },
      { systemId: 'cerner',     trustBand: 'GREEN', capturedAt: '2026-05-09T00:00:00Z', sourceDigest: 'b' },
      { systemId: 'state-mb',   trustBand: 'GREEN', capturedAt: '2026-05-09T00:00:00Z', sourceDigest: 'c' },
    ];
    const a = synchronizeTrustState({ syncId: 's-1', subjectKey: 'npi:1234567890', snapshots });
    const b = synchronizeTrustState({ syncId: 's-1', subjectKey: 'npi:1234567890', snapshots: [...snapshots].reverse() });
    expect(a.reconstructionDigest).toBe(b.reconstructionDigest);
    expect(a.verdict).toBe('CONVERGED');
  });

  it('flags DIVERGENT when snapshots disagree on band', () => {
    const a = synchronizeTrustState({
      syncId: 's-2',
      subjectKey: 'npi:1234567890',
      snapshots: [
        { systemId: 'epic',     trustBand: 'GREEN',  capturedAt: '2026-05-09T00:00:00Z', sourceDigest: 'a' },
        { systemId: 'cerner',   trustBand: 'YELLOW', capturedAt: '2026-05-09T00:00:00Z', sourceDigest: 'b' },
      ],
    });
    expect(a.verdict).toBe('DIVERGENT');
    expect(a.divergent).toBe(true);
  });

  it('flags AMBIGUOUS when any snapshot has trustBand=null', () => {
    const a = synchronizeTrustState({
      syncId: 's-3',
      subjectKey: 'npi:1234567890',
      snapshots: [
        { systemId: 'epic',   trustBand: 'GREEN', capturedAt: '2026-05-09T00:00:00Z', sourceDigest: 'a' },
        { systemId: 'cerner', trustBand: null,    capturedAt: null,                   sourceDigest: 'b' },
      ],
    });
    expect(a.verdict).toBe('AMBIGUOUS');
  });

  it('returns INSUFFICIENT for fewer than 2 snapshots', () => {
    const a = synchronizeTrustState({
      syncId: 's-4',
      subjectKey: 'npi:1234567890',
      snapshots: [
        { systemId: 'epic', trustBand: 'GREEN', capturedAt: null, sourceDigest: 'a' },
      ],
    });
    expect(a.verdict).toBe('INSUFFICIENT');
  });
});

describe('assertSyncVerdict', () => {
  it('throws SYNC_DIVERGENCE_FORCED_CONVERGENT when divergent state asserted CONVERGED', () => {
    const state = synchronizeTrustState({
      syncId: 's-5',
      subjectKey: 'npi:1234567890',
      snapshots: [
        { systemId: 'epic',   trustBand: 'GREEN',  capturedAt: null, sourceDigest: 'a' },
        { systemId: 'cerner', trustBand: 'YELLOW', capturedAt: null, sourceDigest: 'b' },
      ],
    });
    let caught: TrustInteropError | null = null;
    try { assertSyncVerdict(state, 'CONVERGED'); } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('SYNC_DIVERGENCE_FORCED_CONVERGENT');
  });

  it('passes when expected matches actual verdict', () => {
    const state = synchronizeTrustState({
      syncId: 's-6',
      subjectKey: 'npi:1234567890',
      snapshots: [
        { systemId: 'epic',   trustBand: 'GREEN', capturedAt: null, sourceDigest: 'a' },
        { systemId: 'cerner', trustBand: 'GREEN', capturedAt: null, sourceDigest: 'b' },
      ],
    });
    expect(() => assertSyncVerdict(state, 'CONVERGED')).not.toThrow();
  });
});

describe('computeInteropBoundary', () => {
  function buildEnvelopes(): ReplayBridgeEnvelope[] {
    const contract = makeContract();
    const out: ReplayBridgeEnvelope[] = [];
    for (let i = 0; i < 10; i++) {
      const local = quarantineReplay({
        capsuleId: `cap-${i}`,
        integrity: i % 5 === 0 ? ambiguousIntegrity() : cleanIntegrity(),
      });
      out.push(bridgeReplayOutbound({
        bridgeId: `b-${i}`,
        contract,
        fromSystem: 'vitalcv-prod',
        toSystem: contract.systemId,
        record: local,
      }));
    }
    return out;
  }

  it('reports CLEAN/AMBIGUOUS counts and a contained tier', () => {
    const envelopes = buildEnvelopes();
    const boundary = computeInteropBoundary({ envelopes });
    expect(boundary.totalBridged).toBe(10);
    expect(boundary.cleanCount).toBe(8);
    expect(boundary.ambiguousCount).toBe(2);
    expect(boundary.tier).toBe('SINGLE_SYSTEM');
    expect(boundary.partitioned).toBe(true);
  });

  it('flips tier to INTEROP_BLAST_RADIUS_BREACH when rejectedIds is non-empty', () => {
    const envelopes = buildEnvelopes();
    const boundary = computeInteropBoundary({ envelopes, rejectedIds: ['b-bad-1'] });
    expect(boundary.tier).toBe('INTEROP_BLAST_RADIUS_BREACH');
    expect(boundary.partitioned).toBe(false);
    let caught: TrustInteropError | null = null;
    try { assertInteropBoundary(boundary); } catch (e) { caught = e as TrustInteropError; }
    expect(caught?.violation).toBe('INTEROP_BLAST_RADIUS_BREACH');
  });
});
