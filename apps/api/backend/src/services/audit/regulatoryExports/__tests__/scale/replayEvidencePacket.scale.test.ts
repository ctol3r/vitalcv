/**
 * replayEvidencePacket scale gate (W2-PR40A)
 *
 * Asserts the regulator-readable verdict on a replay-engine AuditBundle:
 *   - CLEAN bundles produce a CLEAN verdict.
 *   - Tampered replays surface as TAMPER_DETECTED with non-zero
 *     replaysWithTamper count.
 *   - Bundles with REPLAY_FAILED:* custody entries surface as
 *     PARTIAL_WITH_FAILURES (when no tamper is present).
 *   - The packet hash is deterministic.
 */
import { buildReplayEvidencePacket } from '../../replayEvidencePacket';
import type { AuditBundle, DecisionReplay } from '../../../replayEngine';

function makeReplay(
  capsuleId: string,
  options: {
    hashMatch?: boolean;
    tamperEvidence?: string | null;
    isolationVerdict?: 'ENFORCED' | 'AMBIGUOUS';
  } = {},
): DecisionReplay {
  return {
    schema: 'https://vitalcv.com/replay/v1',
    replayVersion: '1.0',
    capsuleId,
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:1234567890',
    decisionType: 'HIRING',
    decisionTimestamp: '2026-04-01T12:00:00.000Z',
    status: 'VALID',
    decision: {
      action: 'APPROVE',
      outcome: 'VALID',
      triggerEvent: 'EMPLOYER_ACCEPTANCE',
      sourceReferenceId: `accept-${capsuleId}`,
      organizationId: 'org-tenant-A',
      notes: null,
      deploymentContext: null,
    },
    verifierIdentity: {
      type: 'ORGANIZATION',
      systemId: 'vitalcv-engine-v1',
      orgId: 'org-tenant-A',
      userId: null,
      confirmedBy: null,
      timestamp: '2026-04-01T12:00:00.000Z',
    },
    evidenceSnapshot: {
      credentialIds: [],
      evidenceRecords: [],
      sourcesConsulted: [],
      trustStateAtDecision: {
        trustBand: 'L3',
        trustScore: 95,
        readinessStatus: 'READY',
        capturedAt: '2026-04-01T11:55:00.000Z',
        methodology: 'trust_state.v1',
      },
      anomaliesDetected: [],
    },
    integrity: {
      storedHash: 'a'.repeat(64),
      recomputedHash: options.hashMatch === false ? 'b'.repeat(64) : 'a'.repeat(64),
      hashMatch: options.hashMatch ?? true,
      methodology: 'decision_capsule.v262',
      methodologyVersion: 'decision_capsule.v262',
      verifiedAt: '2026-05-01T00:00:00.000Z',
      tamperEvidence: options.tamperEvidence ?? null,
    },
    authorityChain: [],
    relatedDecisions: [],
    replayMetadata: {
      schema: 'vitalcv.runtime-trust-replay.v1',
      correlationId: `corr-${capsuleId}`,
      mutationFingerprint: 'd'.repeat(64),
      mutationClassification: 'DOSSIER_REPLAY',
      replayCategory: 'R-CAT-6',
      payloadHash: 'e'.repeat(64),
      tenantBound: true,
      tenantId: 'org-tenant-A',
    },
    tenantScope: {
      schema: 'vitalcv.tenant-isolation.v1',
      capsuleTenantId: 'org-tenant-A',
      requesterTenantId: 'org-tenant-A',
      isolationVerdict: options.isolationVerdict ?? 'ENFORCED',
      boundaryDigest: 'g'.repeat(64),
      partitionedAt: '2026-05-01T00:00:00.000Z',
    } as DecisionReplay['tenantScope'],
    replayedAt: '2026-05-01T00:00:00.000Z',
  };
}

function makeBundle(replays: DecisionReplay[], failures: number): AuditBundle {
  const exportedAt = '2026-05-01T00:00:00.000Z';
  const failureEntries = Array.from({ length: failures }, (_, i) => ({
    event: `REPLAY_FAILED:bad-${i}:simulated chaos`,
    timestamp: exportedAt,
    actor: 'VitalCV/replayEngine@v1',
  }));
  return {
    schema: 'https://vitalcv.com/audit-bundle/v1',
    bundleVersion: '1.0',
    bundleId: 'bundle-fixture',
    bundleHash: 'h'.repeat(64),
    exportedAt,
    subject: { npi: '1234567890', did: 'did:vitalcv:1234567890' },
    capsuleCount: replays.length,
    issuer: 'VitalCV',
    methodology: 'decision_capsule.v262',
    replays,
    verificationInstructions: {
      hashAlgorithm: 'SHA-256',
      how: 'For each replay, verify integrity.hashMatch === true.',
      replayEndpoint: 'GET https://api.vitalcv.com/api/decisions/{capsuleId}/replay',
      verifyEndpoint: 'GET https://api.vitalcv.com/api/decisions/{capsuleId}/verify',
    },
    custodyLog: [
      { event: 'BUNDLE_CREATED', timestamp: exportedAt, actor: 'VitalCV/replayEngine@v1' },
      ...failureEntries,
      { event: 'HASH_COMPUTED', timestamp: exportedAt, actor: 'VitalCV/replayEngine@v1' },
    ],
  };
}

describe('replayEvidencePacket scale gate', () => {
  it('returns CLEAN verdict for an all-good bundle', () => {
    const bundle = makeBundle(
      [makeReplay('cap-1'), makeReplay('cap-2'), makeReplay('cap-3')],
      0,
    );
    const packet = buildReplayEvidencePacket({
      packetId: 'pkt-1',
      generatedAt: '2026-05-09T00:00:00.000Z',
      bundle,
    });
    expect(packet.integrity.verdict).toBe('CLEAN');
    expect(packet.integrity.replaysWithTamper).toBe(0);
    expect(packet.integrity.failuresInCustody).toBe(0);
    expect(packet.lineage.every((l) => l.tenantIsolationVerdict === 'ENFORCED')).toBe(true);
  });

  it('returns TAMPER_DETECTED when any replay has hashMatch=false', () => {
    const bundle = makeBundle(
      [
        makeReplay('cap-clean'),
        makeReplay('cap-tampered', {
          hashMatch: false,
          tamperEvidence: 'Hash mismatch — stored: a... computed: b...',
        }),
      ],
      0,
    );
    const packet = buildReplayEvidencePacket({
      packetId: 'pkt-tamper',
      generatedAt: '2026-05-09T00:00:00.000Z',
      bundle,
    });
    expect(packet.integrity.verdict).toBe('TAMPER_DETECTED');
    expect(packet.integrity.replaysWithTamper).toBe(1);
  });

  it('returns PARTIAL_WITH_FAILURES when custody contains REPLAY_FAILED entries but no tamper', () => {
    const bundle = makeBundle([makeReplay('cap-1'), makeReplay('cap-2')], 3);
    const packet = buildReplayEvidencePacket({
      packetId: 'pkt-partial',
      generatedAt: '2026-05-09T00:00:00.000Z',
      bundle,
    });
    expect(packet.integrity.verdict).toBe('PARTIAL_WITH_FAILURES');
    expect(packet.integrity.failuresInCustody).toBe(3);
    expect(packet.custody.filter((c) => c.isFailure).length).toBe(3);
  });

  it('returns AMBIGUOUS_NO_REPLAYS when there is nothing to attest', () => {
    const bundle = makeBundle([], 0);
    const packet = buildReplayEvidencePacket({
      packetId: 'pkt-empty',
      generatedAt: '2026-05-09T00:00:00.000Z',
      bundle,
    });
    expect(packet.integrity.verdict).toBe('AMBIGUOUS_NO_REPLAYS');
    expect(packet.lineage).toHaveLength(0);
  });

  it('produces a deterministic packetHash for the same input', () => {
    const bundle = makeBundle(
      [makeReplay('cap-1'), makeReplay('cap-2'), makeReplay('cap-3')],
      0,
    );
    const a = buildReplayEvidencePacket({
      packetId: 'pkt-det',
      generatedAt: '2026-05-09T00:00:00.000Z',
      bundle,
    });
    const b = buildReplayEvidencePacket({
      packetId: 'pkt-det',
      generatedAt: '2026-05-09T00:00:00.000Z',
      bundle,
    });
    expect(a.packetHash).toBe(b.packetHash);
    // eslint-disable-next-line no-console
    console.log(`[scale-board] replay-evidence-packet-hash=${a.packetHash.slice(0, 16)}...`);
  });
});
