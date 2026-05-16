/**
 * Deployment Certification — Chaos (W2-PR104A)
 *
 * Five C-CERT-* chaos modes that intentionally break the certification
 * synthesizer's invariants and assert it fails closed every time. Each mode
 * targets a distinct silent-collapse anti-pattern:
 *
 *   C-CERT-1   evidence-blackout                  → must yield CERT_AMBIGUOUS,
 *                                                   never CERT_GRANTED
 *   C-CERT-2   forged-clean-tampered-manifest    → must yield CERT_DENIED with
 *                                                   LINEAGE_INTEGRITY breach
 *   C-CERT-3   chaos-fingerprint-with-failed-mode → must yield CERT_DENIED with
 *                                                   CHAOS_CONTAINMENT breach
 *   C-CERT-4   silent-survivability-collapse     → must yield CERT_DENIED with
 *                                                   REPLAY_FIDELITY breach
 *   C-CERT-5   ambiguous-coerced-granted          → must throw
 *                                                   AMBIGUOUS_FORCED_GRANTED
 *
 * Mock-free, DB-free — exercises only the pure synthesizer.
 */

import {
  DeploymentCertificationError,
  assertCertification,
  assertCertificationAmbiguityPreserved,
  certifyDeployment,
  trackCertificationDrift,
  type CertificationEvidence,
  type DeploymentCertification,
} from '../deploymentCertification';

interface ChaosVerdict {
  mode: string;
  passed: boolean;
  detail: string;
}

function record(
  verdicts: ChaosVerdict[],
  mode: string,
  passed: boolean,
  detail: string,
): void {
  verdicts.push({ mode, passed, detail });
  // eslint-disable-next-line no-console
  console.log(
    `[cert-chaos] ${passed ? '✓' : '✗'} ${mode} ${passed ? 'failed-closed as required' : 'UNEXPECTED — fail-closed broken'}: ${detail}`,
  );
}

function cleanEvidence(
  overrides: Partial<CertificationEvidence> = {},
): CertificationEvidence {
  return {
    deploymentManifestId: 'manifest-' + 'a'.repeat(56),
    lineageDriftCode: 'DRIFT-CODE-CLEAN',
    configHashDeterministic: true,
    chaosModesPassed: 5,
    chaosModesTotal: 5,
    chaosFingerprint: 'b'.repeat(64),
    replayBoundaryPartitioned: true,
    replayPartialSurvivabilityPct: 95,
    rolloutBoundaryPartitioned: true,
    rolloutPartialAdoptionResiliencePct: 80,
    ...overrides,
  };
}

describe('Deployment certification chaos — fail-closed invariants', () => {
  const verdicts: ChaosVerdict[] = [];

  it('C-CERT-1 evidence-blackout → CERT_AMBIGUOUS, never CERT_GRANTED', () => {
    const cert = certifyDeployment({
      evidence: {
        deploymentManifestId: null,
        lineageDriftCode: null,
        configHashDeterministic: null,
        chaosModesPassed: null,
        chaosModesTotal: null,
        chaosFingerprint: null,
        replayBoundaryPartitioned: null,
        replayPartialSurvivabilityPct: null,
        rolloutBoundaryPartitioned: null,
        rolloutPartialAdoptionResiliencePct: null,
      },
    });
    const ok = cert.verdict === 'CERT_AMBIGUOUS';
    record(
      verdicts,
      'C-CERT-1',
      ok,
      `verdict=${cert.verdict} missing=${cert.ambiguity.missingEvidence.length}`,
    );
    expect(cert.verdict).toBe('CERT_AMBIGUOUS');
    expect(cert.ambiguity.missingEvidence).toHaveLength(5);
  });

  it('C-CERT-2 forged-clean-tampered-manifest → CERT_DENIED with LINEAGE_INTEGRITY breach', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ lineageDriftCode: 'DRIFT-CODE-TAMPER' }),
    });
    const denied = cert.verdict === 'CERT_DENIED';
    const lineageBreach = cert.dimensions.find(
      (d) => d.dimension === 'LINEAGE_INTEGRITY' && !d.passed,
    );
    const ok = denied && !!lineageBreach;
    record(
      verdicts,
      'C-CERT-2',
      ok,
      `verdict=${cert.verdict} lineage.passed=${lineageBreach ? 'false' : 'true'}`,
    );
    expect(cert.verdict).toBe('CERT_DENIED');
    expect(lineageBreach).toBeDefined();

    let caught: unknown = null;
    try {
      assertCertification(cert);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DeploymentCertificationError);
  });

  it('C-CERT-3 chaos-fingerprint-with-failed-mode → CERT_DENIED with CHAOS_CONTAINMENT breach', () => {
    // Adversary pretends chaos succeeded by providing a fingerprint, but the
    // pass count is short by one mode — synthesizer must catch the gap.
    const cert = certifyDeployment({
      evidence: cleanEvidence({
        chaosModesPassed: 4,
        chaosModesTotal: 5,
        chaosFingerprint: 'c'.repeat(64),
      }),
    });
    const chaos = cert.dimensions.find(
      (d) => d.dimension === 'CHAOS_CONTAINMENT' && !d.passed,
    );
    const ok = cert.verdict === 'CERT_DENIED' && !!chaos;
    record(verdicts, 'C-CERT-3', ok, `verdict=${cert.verdict} chaos.passed=false`);
    expect(cert.verdict).toBe('CERT_DENIED');
    expect(chaos).toBeDefined();
  });

  it('C-CERT-4 silent-survivability-collapse → CERT_DENIED with REPLAY_FIDELITY breach', () => {
    // partitioned=true is a forged "all good" signal; the actual pct breaches
    // floor. Synthesizer must catch this.
    const cert = certifyDeployment({
      evidence: cleanEvidence({
        replayBoundaryPartitioned: true,
        replayPartialSurvivabilityPct: 50,
      }),
    });
    const replay = cert.dimensions.find(
      (d) => d.dimension === 'REPLAY_FIDELITY' && !d.passed,
    );
    const ok = cert.verdict === 'CERT_DENIED' && !!replay;
    record(verdicts, 'C-CERT-4', ok, `verdict=${cert.verdict} replay.passed=false`);
    expect(cert.verdict).toBe('CERT_DENIED');
    expect(replay).toBeDefined();
  });

  it('C-CERT-5 ambiguous-coerced-granted → throws AMBIGUOUS_FORCED_GRANTED', () => {
    const granted = certifyDeployment({ evidence: cleanEvidence() });
    const forged: DeploymentCertification = {
      ...granted,
      ambiguity: {
        missingEvidence: ['CHAOS_CONTAINMENT'],
        unresolvedDimensions: ['CHAOS_CONTAINMENT'],
      },
    };
    let caught: DeploymentCertificationError | null = null;
    try {
      assertCertificationAmbiguityPreserved(forged);
    } catch (e) {
      caught = e as DeploymentCertificationError;
    }
    const ok =
      caught !== null && caught.violation === 'AMBIGUOUS_FORCED_GRANTED';
    record(verdicts, 'C-CERT-5', ok, `caught=${caught?.violation ?? 'null'}`);
    expect(caught).toBeInstanceOf(DeploymentCertificationError);
    expect(caught?.violation).toBe('AMBIGUOUS_FORCED_GRANTED');
  });

  it('mixed chaos batch — drift report still reconstructs deterministically', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-09T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence({ chaosModesPassed: 4, chaosModesTotal: 5 }),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const c = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 70 }),
      certifiedAt: '2026-05-10T01:00:00.000Z',
    });
    const forward = trackCertificationDrift({ certifications: [a, b, c] });
    const reversed = trackCertificationDrift({ certifications: [c, b, a] });
    expect(forward.driftDigest).toBe(reversed.driftDigest);
    expect(forward.drift).toBe('LOSS'); // chaotic later → score drops
  });

  it('every chaos mode failed closed (operator-visible aggregate)', () => {
    // eslint-disable-next-line no-console
    console.log(
      `[cert-chaos-board] modes=${verdicts.length} passed=${verdicts.filter((v) => v.passed).length}`,
    );
    expect(verdicts.length).toBeGreaterThanOrEqual(5);
    expect(verdicts.every((v) => v.passed)).toBe(true);
  });
});
