/**
 * Shared synthetic fixtures for the benchmarking test suite. Lives next to
 * the source (not in __tests__/) so jest's testMatch=**\/__tests__/**\/*.ts
 * does not load it as a test file.
 *
 * Pure data builders — no fetches, no DB. Tests use these to drive the
 * pure-transform benchmarking module without spinning up the replay engine.
 */
import type { AuditBundle, DecisionReplay } from '../replayEngine';
import type { ReplayQuarantineRecord } from '../replayCorruptionContainment';

export function makeQuarantine(
  overrides: Partial<ReplayQuarantineRecord> = {},
): ReplayQuarantineRecord {
  return {
    schema: 'vitalcv.replay-corruption-containment.v1',
    capsuleId: overrides.capsuleId ?? 'cap-x',
    verdict: overrides.verdict ?? 'CLEAN',
    kind: overrides.kind ?? null,
    ambiguous: overrides.ambiguous ?? false,
    reason: overrides.reason ?? 'ok',
    containmentDigest: overrides.containmentDigest ?? 'a'.repeat(64),
    isolatedAt: overrides.isolatedAt ?? '2026-05-09T00:00:00.000Z',
    lineageHints: overrides.lineageHints ?? {
      subjectNpi: '1234567890',
      credentialIds: [],
      sourceReferenceId: null,
    },
  };
}

function makeReplay(capsuleId: string, idx: number): DecisionReplay {
  return {
    schema: 'https://vitalcv.com/replay/v1',
    replayVersion: '1.0',
    capsuleId,
    subjectNpi: '1234567890',
    subjectDid: 'did:vitalcv:1234567890',
    decisionType: 'HIRING',
    decisionTimestamp: '2026-04-01T00:00:00.000Z',
    status: 'VALID',
    decision: {
      action: 'APPROVE',
      outcome: 'VALID',
      triggerEvent: null,
      sourceReferenceId: null,
      organizationId: 'org-1',
      notes: null,
      deploymentContext: null,
    },
    verifierIdentity: {
      type: 'SYSTEM',
      systemId: 'vitalcv-engine-v1',
      orgId: 'org-1',
      userId: null,
      confirmedBy: null,
      timestamp: '2026-04-01T00:00:00.000Z',
    },
    evidenceSnapshot: {
      credentialIds: [],
      evidenceRecords: [],
      sourcesConsulted: [],
      trustStateAtDecision: {
        trustBand: 'GREEN',
        trustScore: 90,
        readinessStatus: 'READY',
        capturedAt: '2026-04-01T00:00:00.000Z',
        methodology: 'trust_state.v1',
      },
      anomaliesDetected: [],
    },
    integrity: {
      storedHash: 'a'.repeat(64),
      recomputedHash: 'a'.repeat(64),
      hashMatch: true,
      methodology: 'decision_capsule.v262',
      methodologyVersion: 'decision_capsule.v262',
      verifiedAt: '2026-04-01T00:00:00.000Z',
      tamperEvidence: null,
    },
    authorityChain: [],
    relatedDecisions: [],
    replayMetadata: {
      schema: 'vitalcv.runtime-trust-replay.v1',
      correlationId: `corr-${idx}`,
      mutationFingerprint: 'b'.repeat(64),
      mutationClassification: 'DOSSIER_REPLAY',
      replayCategory: 'R-CAT-6',
      payloadHash: 'c'.repeat(64),
      tenantBound: false,
    },
    tenantScope: {
      schema: 'vitalcv.tenant-isolation.v1',
      capsuleTenantId: 'org-1',
      requesterTenantId: 'org-1',
      isolationVerdict: 'ENFORCED',
      boundaryDigest: 'f'.repeat(64),
      partitionedAt: '2026-04-01T00:00:00.000Z',
    },
    containment: makeQuarantine({ capsuleId }),
    confidenceCalibration: {
      schema: 'vitalcv.calibrated-confidence.v1',
      capsuleId,
      score: {
        lower: 0,
        point: 0,
        upper: 0,
      },
      tier: 'NONE',
      evidenceBasisCount: 0,
      evidenceCeiling: 0,
      overconfidence: {
        detected: true,
        reasons: [
          'SCORE_EXCEEDS_EVIDENCE_CEILING',
          'TRUST_SCORE_INFLATES_ABOVE_EVIDENCE',
        ],
        claimedUncalibratedScore: 0.9,
        evidenceCeiling: 0,
        suppressedTo: 0,
      },
      contributions: [],
      calibrationDigest: '9'.repeat(64),
      calibratedAt: '2026-04-01T00:00:00.000Z',
      methodologyVersion: 'confidence-calibration.v1',
    },
    replayedAt: '2026-04-01T00:00:00.000Z',
  };
}

export interface BundleSpec {
  bundleId?: string;
  capsuleIds?: string[];
  cleanCount?: number;
  quarantinedCount?: number;
  ambiguousCount?: number;
  contaminatedCount?: number;
  breachCount?: number;
  partialSurvivabilityPct?: number;
  partitioned?: boolean;
}

export function makeBundle(spec: BundleSpec = {}): AuditBundle {
  const bundleId = spec.bundleId ?? 'bundle-1';
  const capsuleIds = spec.capsuleIds ?? ['cap-1', 'cap-2', 'cap-3'];
  const replays = capsuleIds.map((id, i) => makeReplay(id, i));

  const cleanCount = spec.cleanCount ?? capsuleIds.length;
  const quarantinedCount = spec.quarantinedCount ?? 0;
  const ambiguousCount = spec.ambiguousCount ?? 0;
  const contaminatedCount = spec.contaminatedCount ?? 0;
  const breachCount = spec.breachCount ?? 0;
  const partialSurvivabilityPct = spec.partialSurvivabilityPct ?? 100;

  const quarantines: ReplayQuarantineRecord[] = [
    ...Array.from({ length: cleanCount }, (_, i) =>
      makeQuarantine({ capsuleId: `${bundleId}-clean-${i}`, verdict: 'CLEAN' }),
    ),
    ...Array.from({ length: quarantinedCount }, (_, i) =>
      makeQuarantine({
        capsuleId: `${bundleId}-q-${i}`,
        verdict: 'QUARANTINED',
        kind: 'HASH_MISMATCH',
        reason: 'hash mismatch',
      }),
    ),
    ...Array.from({ length: ambiguousCount }, (_, i) =>
      makeQuarantine({
        capsuleId: `${bundleId}-amb-${i}`,
        verdict: 'AMBIGUOUS',
        kind: 'AMBIGUOUS_INTEGRITY',
        ambiguous: true,
        reason: 'contradictory signals',
      }),
    ),
    ...Array.from({ length: contaminatedCount }, (_, i) =>
      makeQuarantine({
        capsuleId: `${bundleId}-cont-${i}`,
        verdict: 'CONTAMINATED',
        kind: 'DEPENDENCY_CORRUPTION',
        reason: 'lineage downstream',
      }),
    ),
    ...Array.from({ length: breachCount }, (_, i) =>
      makeQuarantine({
        capsuleId: `${bundleId}-breach-${i}`,
        verdict: 'CONTAINMENT_BREACH',
        kind: 'STRUCTURAL_CORRUPTION',
        reason: 'evaluator failure',
      }),
    ),
  ];

  return {
    schema: 'https://vitalcv.com/audit-bundle/v1',
    bundleVersion: '1.0',
    bundleId,
    bundleHash: 'd'.repeat(64),
    exportedAt: '2026-04-01T01:00:00.000Z',
    subject: { npi: '1234567890', did: 'did:vitalcv:1234567890' },
    capsuleCount: capsuleIds.length,
    issuer: 'VitalCV',
    methodology: 'decision_capsule.v262',
    replays,
    verificationInstructions: {
      hashAlgorithm: 'SHA-256',
      how: 'verify each replay',
      replayEndpoint: 'GET /api/decisions/{id}/replay',
      verifyEndpoint: 'GET /api/decisions/{id}/verify',
    },
    custodyLog: [],
    containment: {
      schema: 'vitalcv.replay-containment-report.v1',
      boundary: {
        schema: 'vitalcv.replay-containment-boundary.v1',
        partitioned: spec.partitioned ?? true,
        totalReplayed: capsuleIds.length,
        cleanCount,
        quarantinedCount,
        ambiguousCount,
        contaminatedCount,
        containmentRatio: cleanCount / Math.max(1, capsuleIds.length),
        partialSurvivabilityPct,
        containmentReason: 'synthetic',
        boundaryDigest: 'e'.repeat(64),
        partitionedAt: '2026-04-01T01:00:00.000Z',
      },
      quarantines,
      lineages: [],
    },
  };
}

export function makeMutationSamples(spec: {
  count: number;
  denialRate?: number;
  silentReclassifyEvery?: number;
  duplicateFingerprintCount?: number;
}): Array<{
  mutationFingerprint: string;
  classification: 'TRUST_ACCEPTANCE' | 'DENIED_MUTATION' | 'TRUST_REFRESH_REQUEST';
  replayCategory: 'R-CAT-1' | 'R-CAT-2' | 'R-CAT-5';
  outcome: 'allowed' | 'denied';
  denialReason?: string | null;
  observedAtMs: number;
  elapsedMs: number;
}> {
  const out: ReturnType<typeof makeMutationSamples> = [];
  const denialRate = spec.denialRate ?? 0.25;
  const denialEvery = Math.round(1 / denialRate);
  const silentEvery = spec.silentReclassifyEvery ?? 0;
  const duplicates = spec.duplicateFingerprintCount ?? 0;

  for (let i = 0; i < spec.count; i++) {
    const isDenied = i % denialEvery === 0;
    const isSilent = silentEvery > 0 && i % silentEvery === 0 && isDenied;
    out.push({
      mutationFingerprint: `fp-${i}`,
      classification: isDenied
        ? isSilent
          ? 'TRUST_ACCEPTANCE'
          : 'DENIED_MUTATION'
        : 'TRUST_ACCEPTANCE',
      replayCategory: isDenied ? (isSilent ? 'R-CAT-1' : 'R-CAT-5') : 'R-CAT-1',
      outcome: isDenied ? 'denied' : 'allowed',
      denialReason: isDenied && !isSilent ? `denial-${i}` : null,
      observedAtMs: 1_700_000_000_000 + i * 5,
      elapsedMs: 0.5 + (i % 10) * 0.1,
    });
  }
  for (let d = 0; d < duplicates; d++) {
    out.push({
      mutationFingerprint: 'fp-0',
      classification: 'TRUST_ACCEPTANCE',
      replayCategory: 'R-CAT-1',
      outcome: 'allowed',
      observedAtMs: 1_700_000_000_000 + (spec.count + d) * 5,
      elapsedMs: 0.5,
    });
  }
  return out;
}
