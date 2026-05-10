/**
 * Activation Readiness — Chaos Simulations (W2-PR144A)
 *
 * Adversarial test suite. Each scenario attempts to produce a false READY
 * verdict under degraded or tampered conditions. Every case must be
 * detected — no silent activation on bad evidence.
 *
 * Scenarios:
 *   1. Empty evidence slice → EMPTY_EVIDENCE_SLICE error
 *   2. Single CONTAINMENT_BREACH capsule voids composite → ACTIVATION_BREACH
 *   3. All capsules lack replay IDs → ACTIVATION_AMBIGUOUS
 *   4. OPERATOR ready, all others BLOCKED → NOT_READY
 *   5. One AMBIGUOUS dimension blocks READY verdict
 *   6. Evidence score 100 with CONTAMINATED containment → score voided
 *   7. Replay-validation: missing anchor → REPLAY_MISSING
 *   8. Replay-validation: stale anchor → REPLAY_STALE
 *   9. Replay-validation: evidence spine drift → EVIDENCE_SPINE_DRIFTED
 *  10. Survivability: FATAL failure → SURVIVABILITY_FAILED
 *  11. Survivability: fail-open detection (failedClosed=false)
 *  12. Telemetry: overconfidence episode accumulates
 *  13. Lineage manifest: breach count enumerated, not suppressed
 *  14. Ecosystem survivability: one failed institution collapses overall
 */

import {
  scoreActivationReadiness,
  ActivationReadinessError,
  ACTIVATION_READINESS_SENTINELS,
  type ReadinessEvidenceCapsule,
} from '../activationReadiness';
import {
  validateActivationReplay,
  REPLAY_ACTIVATION_SENTINELS,
  type ReplayAnchor,
} from '../activationReplayValidation';
import {
  verifyInstitutionalSurvivability,
  buildEcosystemSurvivabilityReport,
  type SurvivabilityFailureEvent,
} from '../institutionalSurvivability';
import { buildActivationConfidenceTelemetry } from '../activationConfidenceTelemetry';
import { sealReadinessLineageManifest } from '../readinessLineageManifest';

// ── helpers ────────────────────────────────────────────────────────────────────

function cleanCapsule(
  overrides: Partial<ReadinessEvidenceCapsule> = {},
): ReadinessEvidenceCapsule {
  return {
    schema: 'vitalcv.activation-evidence.v1',
    capsuleId: `cap-${Math.random().toString(36).slice(2, 8)}`,
    dimension: 'OPERATOR',
    evidenceScore: 90,
    containmentVerdict: 'CLEAN',
    replayCapsuleIds: ['replay-1'],
    observedAt: new Date().toISOString(),
    ...overrides,
  };
}

function cleanAnchor(overrides: Partial<ReplayAnchor> = {}): ReplayAnchor {
  return {
    schema: 'vitalcv.replay-anchor.v1',
    capsuleId: 'anchor-1',
    capturedAt: new Date(Date.now() - 60_000).toISOString(), // 1 min ago
    containmentVerdict: 'CLEAN',
    evidenceSpineHash: 'abc123',
    replayVerified: true,
    ...overrides,
  };
}

// ── chaos scenarios ────────────────────────────────────────────────────────────

describe('Chaos 1 — empty evidence slice throws EMPTY_EVIDENCE_SLICE', () => {
  it('throws on empty capsule array', () => {
    expect(() => scoreActivationReadiness([])).toThrow(ActivationReadinessError);
    try {
      scoreActivationReadiness([]);
    } catch (e) {
      expect(e).toBeInstanceOf(ActivationReadinessError);
      expect((e as ActivationReadinessError).violation).toBe('EMPTY_EVIDENCE_SLICE');
    }
  });
});

describe('Chaos 2 — single CONTAINMENT_BREACH capsule voids composite', () => {
  it('returns ACTIVATION_BREACH and null compositeReadiness', () => {
    const capsules: ReadinessEvidenceCapsule[] = [
      cleanCapsule({ dimension: 'OPERATOR', containmentVerdict: 'CONTAINMENT_BREACH' }),
      cleanCapsule({ dimension: 'VERIFIER', evidenceScore: 100 }),
      cleanCapsule({ dimension: 'EXECUTIVE', evidenceScore: 100 }),
      cleanCapsule({ dimension: 'ECOSYSTEM', evidenceScore: 100 }),
    ];
    const result = scoreActivationReadiness(capsules);
    expect(result.overallVerdict).toBe('ACTIVATION_BREACH');
    expect(result.compositeReadiness).toBeNull();
    expect(result.confidenceScore).toBe(0);
    expect(result.evidenceCeiling).toBe(0);
  });
});

describe('Chaos 3 — all capsules lack replay IDs → ACTIVATION_AMBIGUOUS', () => {
  it('surfaces ACTIVATION_AMBIGUOUS when no capsule has replay IDs', () => {
    const capsules: ReadinessEvidenceCapsule[] = [
      cleanCapsule({ dimension: 'OPERATOR', replayCapsuleIds: [] }),
      cleanCapsule({ dimension: 'VERIFIER', replayCapsuleIds: [] }),
      cleanCapsule({ dimension: 'EXECUTIVE', replayCapsuleIds: [] }),
      cleanCapsule({ dimension: 'ECOSYSTEM', replayCapsuleIds: [] }),
    ];
    const result = scoreActivationReadiness(capsules);
    expect(result.overallVerdict).toBe('ACTIVATION_AMBIGUOUS');
    expect(result.compositeReadiness).toBeNull();
  });
});

describe('Chaos 4 — OPERATOR ready, all others BLOCKED → NOT_READY', () => {
  it('returns NOT_READY when non-operator dimensions are blocked', () => {
    const capsules: ReadinessEvidenceCapsule[] = [
      cleanCapsule({ dimension: 'OPERATOR', evidenceScore: 95 }),
      cleanCapsule({ dimension: 'VERIFIER', evidenceScore: 10 }),
      cleanCapsule({ dimension: 'EXECUTIVE', evidenceScore: 10 }),
      cleanCapsule({ dimension: 'ECOSYSTEM', evidenceScore: 10 }),
    ];
    const result = scoreActivationReadiness(capsules);
    expect(result.overallVerdict).toBe('NOT_READY');
    const operator = result.dimensions.find(d => d.dimension === 'OPERATOR');
    const verifier = result.dimensions.find(d => d.dimension === 'VERIFIER');
    expect(operator?.status).toBe('PASSING');
    expect(verifier?.status).toBe('BLOCKED');
  });
});

describe('Chaos 5 — one AMBIGUOUS dimension blocks READY verdict', () => {
  it('returns ACTIVATION_AMBIGUOUS when one dimension lacks replay IDs', () => {
    const capsules: ReadinessEvidenceCapsule[] = [
      cleanCapsule({ dimension: 'OPERATOR', evidenceScore: 95 }),
      cleanCapsule({ dimension: 'VERIFIER', evidenceScore: 95 }),
      cleanCapsule({ dimension: 'EXECUTIVE', evidenceScore: 95 }),
      // ECOSYSTEM has no replay IDs → AMBIGUOUS
      cleanCapsule({ dimension: 'ECOSYSTEM', evidenceScore: 95, replayCapsuleIds: [] }),
    ];
    const result = scoreActivationReadiness(capsules);
    expect(result.overallVerdict).toBe('ACTIVATION_AMBIGUOUS');
  });
});

describe('Chaos 6 — evidenceScore=100 with CONTAMINATED containment voids score', () => {
  it('treats CONTAMINATED capsule as not replay-safe → low composite', () => {
    const capsules: ReadinessEvidenceCapsule[] = [
      cleanCapsule({
        dimension: 'OPERATOR',
        evidenceScore: 100,
        containmentVerdict: 'CONTAMINATED',
        replayCapsuleIds: ['replay-1'],
      }),
    ];
    const result = scoreActivationReadiness(capsules);
    const op = result.dimensions.find(d => d.dimension === 'OPERATOR');
    // CONTAMINATED capsules are not replay-safe; evidenceCeiling = 0
    expect(op?.replaySafeCapsuleCount).toBe(0);
    expect(op?.evidenceCeiling).toBe(0);
  });
});

describe('Chaos 7 — replay validation: missing anchor → REPLAY_MISSING', () => {
  it('returns REPLAY_MISSING with NO_ANCHOR_CAPSULE failure reason', () => {
    const result = validateActivationReplay({
      activationId: 'act-1',
      proposedAt: new Date().toISOString(),
      anchor: null,
      currentEvidenceSpineHash: 'abc123',
    });
    expect(result.verdict).toBe('REPLAY_MISSING');
    expect(result.failureReasons).toContain('NO_ANCHOR_CAPSULE');
    expect(result.anchorCapsuleId).toBeNull();
  });
});

describe('Chaos 8 — replay validation: stale anchor → REPLAY_STALE', () => {
  it('returns REPLAY_STALE when anchor age exceeds maxReplayAgeMs', () => {
    const oldCapturedAt = new Date(
      Date.now() - (REPLAY_ACTIVATION_SENTINELS.DEFAULT_MAX_REPLAY_AGE_MS + 60_000),
    ).toISOString();
    const result = validateActivationReplay({
      activationId: 'act-stale',
      proposedAt: new Date().toISOString(),
      anchor: cleanAnchor({ capturedAt: oldCapturedAt }),
      currentEvidenceSpineHash: 'abc123',
    });
    expect(result.verdict).toBe('REPLAY_STALE');
    expect(result.failureReasons).toContain('ANCHOR_STALE');
  });
});

describe('Chaos 9 — replay validation: evidence spine drift', () => {
  it('flags EVIDENCE_SPINE_DRIFTED when hashes differ', () => {
    const result = validateActivationReplay({
      activationId: 'act-drift',
      proposedAt: new Date().toISOString(),
      anchor: cleanAnchor({ evidenceSpineHash: 'abc123' }),
      currentEvidenceSpineHash: 'DIFFERENT_HASH',
    });
    expect(result.evidenceSpineDrifted).toBe(true);
    expect(result.failureReasons).toContain('EVIDENCE_SPINE_DRIFTED');
  });
});

describe('Chaos 10 — survivability: FATAL failure → SURVIVABILITY_FAILED', () => {
  it('fails the institution when a FATAL event is present', () => {
    const fatalEvent: SurvivabilityFailureEvent = {
      schema: 'vitalcv.survivability-failure.v1',
      institutionId: 'inst-1',
      mode: 'EVIDENCE_SPINE_COLLAPSE',
      severity: 'FATAL',
      detectedAt: new Date().toISOString(),
      failedClosed: true,
    };
    const result = verifyInstitutionalSurvivability({
      institutionId: 'inst-1',
      observationWindowStart: new Date(Date.now() - 3600_000).toISOString(),
      observationWindowEnd: new Date().toISOString(),
      failureEvents: [fatalEvent],
      activationSuccessRate: 0.98,
      replayFallbackConfigured: true,
    });
    expect(result.verdict).toBe('SURVIVABILITY_FAILED');
    expect(result.fatalFailureCount).toBe(1);
  });
});

describe('Chaos 11 — survivability: fail-open detection', () => {
  it('detects imperfect fail-closed compliance', () => {
    const failOpenEvent: SurvivabilityFailureEvent = {
      schema: 'vitalcv.survivability-failure.v1',
      institutionId: 'inst-2',
      mode: 'AUTH_DEGRADATION',
      severity: 'DEGRADING',
      detectedAt: new Date().toISOString(),
      failedClosed: false, // system activated on degraded evidence — fail-open
    };
    const result = verifyInstitutionalSurvivability({
      institutionId: 'inst-2',
      observationWindowStart: new Date(Date.now() - 3600_000).toISOString(),
      observationWindowEnd: new Date().toISOString(),
      failureEvents: [failOpenEvent],
      activationSuccessRate: 0.95,
      replayFallbackConfigured: true,
    });
    expect(result.perfectFailClosedCompliance).toBe(false);
    expect(result.failedClosedRate).toBeLessThan(1.0);
  });
});

describe('Chaos 12 — telemetry: overconfidence episode accumulates', () => {
  it('flags scores where compositeReadiness exceeds evidenceCeiling', () => {
    const overconfidentScore = {
      schema: 'vitalcv.activation-readiness.v1' as const,
      scoreId: 'sc-oc-1',
      overallVerdict: 'READY' as const,
      compositeReadiness: 95,
      evidenceCeiling: 50, // readiness > ceiling → overconfidence
      dimensions: [],
      confidenceScore: 0.5,
      readinessDigest: 'digest-1',
      scoredAt: new Date().toISOString(),
      methodologyVersion: 'activation-readiness.v1' as const,
    };
    const telemetry = buildActivationConfidenceTelemetry([overconfidentScore]);
    expect(telemetry.overconfidenceEpisodes).toHaveLength(1);
    expect(telemetry.overconfidenceEpisodes[0].excessAmount).toBe(45);
  });
});

describe('Chaos 13 — lineage manifest: breach capsule enumerated, not suppressed', () => {
  it('counts CONTAINMENT_BREACH capsules in breachCount', () => {
    const capsule = cleanCapsule({ containmentVerdict: 'CONTAINMENT_BREACH' });
    const score = scoreActivationReadiness([capsule]);
    const manifest = sealReadinessLineageManifest(score, [capsule]);
    expect(manifest.breachCount).toBe(1);
    expect(manifest.overallVerdict).toBe('ACTIVATION_BREACH');
  });
});

describe('Chaos 14 — ecosystem survivability: one failed institution collapses overall', () => {
  it('returns SURVIVABILITY_FAILED when any institution fails', () => {
    const survivableResult = verifyInstitutionalSurvivability({
      institutionId: 'inst-ok',
      observationWindowStart: new Date(Date.now() - 3600_000).toISOString(),
      observationWindowEnd: new Date().toISOString(),
      failureEvents: [],
      activationSuccessRate: 1.0,
      replayFallbackConfigured: true,
    });
    const failedResult = verifyInstitutionalSurvivability({
      institutionId: 'inst-fail',
      observationWindowStart: new Date(Date.now() - 3600_000).toISOString(),
      observationWindowEnd: new Date().toISOString(),
      failureEvents: [{
        schema: 'vitalcv.survivability-failure.v1',
        institutionId: 'inst-fail',
        mode: 'TENANT_ISOLATION_FAILURE',
        severity: 'FATAL',
        detectedAt: new Date().toISOString(),
        failedClosed: true,
      }],
      activationSuccessRate: 0.5,
      replayFallbackConfigured: false,
    });
    const report = buildEcosystemSurvivabilityReport([survivableResult, failedResult]);
    expect(report.overallVerdict).toBe('SURVIVABILITY_FAILED');
    expect(report.failedInstitutionCount).toBe(1);
    expect(report.survivableInstitutionCount).toBe(1);
  });
});
