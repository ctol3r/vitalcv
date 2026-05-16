/**
 * Pure-transform unit coverage for the W2-PR104A institutional deployment
 * certification synthesizer. Mock-free, DB-free.
 */

import {
  DEPLOYMENT_CERTIFICATION_SENTINELS,
  DeploymentCertificationError,
  KNOWN_CERTIFICATION_DIMENSIONS,
  KNOWN_CERTIFICATION_VERDICTS,
  assertCertification,
  assertCertificationAmbiguityPreserved,
  certificationDigest,
  certifyDeployment,
  evaluateCertification,
  trackCertificationDrift,
  type CertificationEvidence,
  type DeploymentCertification,
} from '../deploymentCertification';

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

function emptyEvidence(): CertificationEvidence {
  return {
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
  };
}

describe('certifyDeployment — clean evidence path', () => {
  it('grants certification when every dimension passes its floor', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    expect(cert.verdict).toBe('CERT_GRANTED');
    expect(cert.score).toBeGreaterThanOrEqual(
      DEPLOYMENT_CERTIFICATION_SENTINELS.DEFAULT_MIN_CERTIFICATION_SCORE,
    );
    expect(cert.dimensions).toHaveLength(
      KNOWN_CERTIFICATION_DIMENSIONS.length,
    );
    for (const d of cert.dimensions) {
      expect(d.passed).toBe(true);
      expect(d.ambiguous).toBe(false);
    }
    expect(cert.ambiguity.missingEvidence).toEqual([]);
    expect(cert.lineage.deploymentManifestId).toBe(
      cleanEvidence().deploymentManifestId,
    );
  });

  it('certifyingsame evidence twice produces the same certificationId', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    expect(a.certificationId).toBe(b.certificationId);
  });

  it('changing any evidence field changes the certificationId', () => {
    const base = certifyDeployment({ evidence: cleanEvidence() });
    const tampered = certifyDeployment({
      evidence: cleanEvidence({ chaosModesPassed: 4 }),
    });
    expect(base.certificationId).not.toBe(tampered.certificationId);
  });

  it('SHA-only drift counts as clean lineage (deploy-after expected)', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ lineageDriftCode: 'DRIFT-CODE-SHA' }),
    });
    const lineage = cert.dimensions.find(
      (d) => d.dimension === 'LINEAGE_INTEGRITY',
    );
    expect(lineage?.passed).toBe(true);
    expect(cert.verdict).toBe('CERT_GRANTED');
  });
});

describe('certifyDeployment — ambiguity preservation', () => {
  it('null evidence on every dim → CERT_AMBIGUOUS, never coerced clean', () => {
    const cert = certifyDeployment({ evidence: emptyEvidence() });
    expect(cert.verdict).toBe('CERT_AMBIGUOUS');
    expect(cert.ambiguity.missingEvidence).toHaveLength(
      KNOWN_CERTIFICATION_DIMENSIONS.length,
    );
    for (const d of cert.dimensions) {
      expect(d.ambiguous).toBe(true);
      expect(d.passed).toBe(false);
    }
  });

  it('partial evidence with passing remainder → CERT_PROVISIONAL', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({
        rolloutBoundaryPartitioned: null,
        rolloutPartialAdoptionResiliencePct: null,
      }),
    });
    expect(cert.verdict).toBe('CERT_PROVISIONAL');
    expect(cert.ambiguity.missingEvidence).toEqual(['ROLLOUT_SURVIVABILITY']);
  });

  it('partial evidence with failing remainder → CERT_AMBIGUOUS (not GRANTED)', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({
        rolloutBoundaryPartitioned: null,
        rolloutPartialAdoptionResiliencePct: null,
        replayPartialSurvivabilityPct: 10,
      }),
    });
    expect(cert.verdict).toBe('CERT_DENIED');
  });
});

describe('certifyDeployment — fail-closed dimension breaches', () => {
  it('lineage drift TAMPER → CERT_DENIED with LINEAGE_INTEGRITY breach', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ lineageDriftCode: 'DRIFT-CODE-TAMPER' }),
    });
    expect(cert.verdict).toBe('CERT_DENIED');
    const dim = cert.dimensions.find(
      (d) => d.dimension === 'LINEAGE_INTEGRITY',
    );
    expect(dim?.passed).toBe(false);
  });

  it('chaos mode failed → CERT_DENIED', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ chaosModesPassed: 4, chaosModesTotal: 5 }),
    });
    expect(cert.verdict).toBe('CERT_DENIED');
    expect(
      cert.dimensions.find((d) => d.dimension === 'CHAOS_CONTAINMENT')?.passed,
    ).toBe(false);
  });

  it('rollout boundary breach → CERT_DENIED', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({
        rolloutBoundaryPartitioned: false,
        rolloutPartialAdoptionResiliencePct: 30,
      }),
    });
    expect(cert.verdict).toBe('CERT_DENIED');
  });

  it('config hash non-deterministic → CERT_DENIED', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ configHashDeterministic: false }),
    });
    expect(cert.verdict).toBe('CERT_DENIED');
  });

  it('replay survivability below floor → CERT_DENIED', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 50 }),
    });
    expect(cert.verdict).toBe('CERT_DENIED');
  });
});

describe('certificationDigest — determinism', () => {
  it('produces identical digest for equivalent evidence in either source order', () => {
    const e1 = cleanEvidence();
    const e2 = cleanEvidence();
    const cert1 = certifyDeployment({
      evidence: e1,
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const cert2 = certifyDeployment({
      evidence: e2,
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    expect(certificationDigest({ evidence: e1, dimensions: cert1.dimensions })).toBe(
      certificationDigest({ evidence: e2, dimensions: cert2.dimensions }),
    );
  });
});

describe('assertCertification — fail-closed at boundary', () => {
  it('throws DeploymentCertificationError on CERT_DENIED', () => {
    const denied = certifyDeployment({
      evidence: cleanEvidence({ lineageDriftCode: 'DRIFT-CODE-CONFIG' }),
    });
    expect(() => assertCertification(denied)).toThrow(
      DeploymentCertificationError,
    );
  });

  it('does not throw on CERT_GRANTED', () => {
    const granted = certifyDeployment({ evidence: cleanEvidence() });
    expect(() => assertCertification(granted)).not.toThrow();
  });

  it('throws AMBIGUOUS_FORCED_GRANTED if a granted cert has missing-evidence dims', () => {
    const granted = certifyDeployment({ evidence: cleanEvidence() });
    const forged: DeploymentCertification = {
      ...granted,
      ambiguity: {
        missingEvidence: ['ROLLOUT_SURVIVABILITY'],
        unresolvedDimensions: ['ROLLOUT_SURVIVABILITY'],
      },
    };
    let caught: unknown = null;
    try {
      assertCertificationAmbiguityPreserved(forged);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(DeploymentCertificationError);
    expect((caught as DeploymentCertificationError).violation).toBe(
      'AMBIGUOUS_FORCED_GRANTED',
    );
  });
});

describe('lineage drift — current vs previous', () => {
  it('UNKNOWN drift when no previous score supplied', () => {
    const cert = certifyDeployment({ evidence: cleanEvidence() });
    expect(cert.lineage.drift).toBe('UNKNOWN');
    expect(cert.lineage.deltaScore).toBeNull();
  });

  it('STABLE when delta is < 1e-9', () => {
    const baseline = certifyDeployment({ evidence: cleanEvidence() });
    const cert = certifyDeployment({
      evidence: cleanEvidence(),
      previousScore: baseline.score,
    });
    expect(cert.lineage.drift).toBe('STABLE');
  });

  it('GAIN when current > previous', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence(),
      previousScore: 0.5,
    });
    expect(cert.lineage.drift).toBe('GAIN');
    expect(cert.lineage.deltaScore).toBeGreaterThan(0);
  });

  it('LOSS when current < previous', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 80 }),
      previousScore: 1.0,
    });
    expect(cert.lineage.drift).toBe('LOSS');
    expect(cert.lineage.deltaScore).toBeLessThan(0);
  });
});

describe('trackCertificationDrift — longitudinal', () => {
  it('STABLE drift across two identical certifications', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-09T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const drift = trackCertificationDrift({ certifications: [a, b] });
    expect(drift.drift).toBe('STABLE');
    expect(drift.longitudinalDelta).toBeCloseTo(0);
    expect(drift.certifications).toHaveLength(2);
  });

  it('LOSS drift when a later certification has lower score', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-09T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 70 }),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const drift = trackCertificationDrift({ certifications: [a, b] });
    expect(drift.drift).toBe('LOSS');
    expect(drift.longitudinalDelta!).toBeLessThan(0);
  });

  it('driftDigest is order-independent on input array', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-09T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 90 }),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const forward = trackCertificationDrift({ certifications: [a, b] });
    const reversed = trackCertificationDrift({ certifications: [b, a] });
    expect(forward.driftDigest).toBe(reversed.driftDigest);
  });

  it('per-dimension drift records first/last/delta for every known dim', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-09T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence({ rolloutPartialAdoptionResiliencePct: 90 }),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const drift = trackCertificationDrift({ certifications: [a, b] });
    expect(drift.perDimensionDrift).toHaveLength(
      KNOWN_CERTIFICATION_DIMENSIONS.length,
    );
    const rollout = drift.perDimensionDrift.find(
      (d) => d.dimension === 'ROLLOUT_SURVIVABILITY',
    );
    expect(rollout?.delta).toBeGreaterThan(0);
    expect(rollout?.drift).toBe('GAIN');
  });

  it('UNKNOWN drift on empty input', () => {
    const drift = trackCertificationDrift({ certifications: [] });
    expect(drift.drift).toBe('UNKNOWN');
    expect(drift.longitudinalDelta).toBeNull();
    expect(drift.certifications).toHaveLength(0);
  });
});

describe('evaluateCertification — non-throwing wrapper', () => {
  it('returns a normal certification on clean evidence', () => {
    const cert = evaluateCertification({ evidence: cleanEvidence() });
    expect(KNOWN_CERTIFICATION_VERDICTS).toContain(cert.verdict);
  });
});

describe('chaos containment — must reject zero-mode runs as ambiguous', () => {
  it('zero modes total marks chaos dim ambiguous, not passed', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({ chaosModesPassed: 0, chaosModesTotal: 0 }),
    });
    const dim = cert.dimensions.find(
      (d) => d.dimension === 'CHAOS_CONTAINMENT',
    );
    expect(dim?.ambiguous).toBe(true);
    expect(dim?.passed).toBe(false);
  });
});
