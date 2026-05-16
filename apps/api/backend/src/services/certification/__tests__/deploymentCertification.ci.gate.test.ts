/**
 * Deployment Certification — CI Gate (W2-PR104A)
 *
 * Canary suite. Every public primitive must:
 *   - throw DeploymentCertificationError on certification breaches (not silently allow);
 *   - export an enumerated `violation` field;
 *   - never coerce CERT_AMBIGUOUS verdicts to CERT_GRANTED (silent-collapse anti-pattern);
 *   - produce a deterministic certificationId (not collide across inputs);
 *   - keep dimension weights frozen so a future refactor cannot silently rebalance scoring.
 *
 * If a future refactor accidentally weakens any of these invariants, this
 * suite breaks the build before the regression ships.
 */

import {
  DEPLOYMENT_CERTIFICATION_SENTINELS,
  DeploymentCertificationError,
  KNOWN_CERTIFICATION_DIMENSIONS,
  KNOWN_CERTIFICATION_VERDICTS,
  KNOWN_CERTIFICATION_VIOLATIONS,
  KNOWN_LINEAGE_DRIFT_CODES,
  assertCertification,
  assertCertificationAmbiguityPreserved,
  certificationDigest,
  certifyDeployment,
  trackCertificationDrift,
  type CertificationDimension,
  type CertificationEvidence,
  type CertificationVerdict,
  type LineageDriftCode,
} from '../deploymentCertification';

const KNOWN_VIOLATIONS = [
  'AMBIGUOUS_FORCED_GRANTED',
  'DIMENSION_BREACH',
  'CERTIFICATION_FLOOR_BREACHED',
  'EVIDENCE_OPEN_FAILURE',
] as const;

const KNOWN_DIMENSIONS: CertificationDimension[] = [
  'LINEAGE_INTEGRITY',
  'REPLAY_FIDELITY',
  'CHAOS_CONTAINMENT',
  'ROLLOUT_SURVIVABILITY',
  'CONFIG_DETERMINISM',
];

const KNOWN_VERDICTS: CertificationVerdict[] = [
  'CERT_GRANTED',
  'CERT_PROVISIONAL',
  'CERT_AMBIGUOUS',
  'CERT_DENIED',
];

const KNOWN_DRIFT_CODES: LineageDriftCode[] = [
  'DRIFT-CODE-CLEAN',
  'DRIFT-CODE-SHA',
  'DRIFT-CODE-CONFIG',
  'DRIFT-CODE-LOCK',
  'DRIFT-CODE-ORPHAN',
  'DRIFT-CODE-TAMPER',
];

describe('CI gate — exported enums match runtime sentinels', () => {
  it('every exported dimension is in KNOWN_CERTIFICATION_DIMENSIONS', () => {
    for (const d of KNOWN_DIMENSIONS) {
      expect(KNOWN_CERTIFICATION_DIMENSIONS).toContain(d);
    }
    expect(KNOWN_CERTIFICATION_DIMENSIONS).toHaveLength(KNOWN_DIMENSIONS.length);
  });

  it('every exported verdict is in KNOWN_CERTIFICATION_VERDICTS', () => {
    for (const v of KNOWN_VERDICTS) {
      expect(KNOWN_CERTIFICATION_VERDICTS).toContain(v);
    }
    expect(KNOWN_CERTIFICATION_VERDICTS).toHaveLength(KNOWN_VERDICTS.length);
  });

  it('every exported violation is in KNOWN_CERTIFICATION_VIOLATIONS', () => {
    for (const v of KNOWN_VIOLATIONS) {
      expect(KNOWN_CERTIFICATION_VIOLATIONS).toContain(v);
    }
    expect(KNOWN_CERTIFICATION_VIOLATIONS).toHaveLength(KNOWN_VIOLATIONS.length);
  });

  it('every exported drift code is in KNOWN_LINEAGE_DRIFT_CODES', () => {
    for (const c of KNOWN_DRIFT_CODES) {
      expect(KNOWN_LINEAGE_DRIFT_CODES).toContain(c);
    }
    expect(KNOWN_LINEAGE_DRIFT_CODES).toHaveLength(KNOWN_DRIFT_CODES.length);
  });

  it('verdict / dimension / violation / sentinel objects are frozen', () => {
    expect(Object.isFrozen(KNOWN_CERTIFICATION_DIMENSIONS)).toBe(true);
    expect(Object.isFrozen(KNOWN_CERTIFICATION_VERDICTS)).toBe(true);
    expect(Object.isFrozen(KNOWN_CERTIFICATION_VIOLATIONS)).toBe(true);
    expect(Object.isFrozen(KNOWN_LINEAGE_DRIFT_CODES)).toBe(true);
    expect(Object.isFrozen(DEPLOYMENT_CERTIFICATION_SENTINELS)).toBe(true);
    expect(
      Object.isFrozen(DEPLOYMENT_CERTIFICATION_SENTINELS.DIMENSION_WEIGHTS),
    ).toBe(true);
  });

  it('dimension weights sum to 1.0', () => {
    const weights = DEPLOYMENT_CERTIFICATION_SENTINELS.DIMENSION_WEIGHTS;
    const total = KNOWN_CERTIFICATION_DIMENSIONS.reduce(
      (acc, d) => acc + weights[d],
      0,
    );
    expect(total).toBeCloseTo(1.0, 9);
  });
});

describe('CI gate — DeploymentCertificationError contract', () => {
  it('every breach primitive throws a DeploymentCertificationError with a known violation', () => {
    const cases: Array<{
      name: string;
      run: () => void;
      expected: (typeof KNOWN_VIOLATIONS)[number];
    }> = [
      {
        name: 'assertCertification on CERT_DENIED throws DIMENSION_BREACH',
        expected: 'DIMENSION_BREACH',
        run: () => {
          const denied = certifyDeployment({
            evidence: cleanEvidence({ lineageDriftCode: 'DRIFT-CODE-CONFIG' }),
          });
          assertCertification(denied);
        },
      },
      {
        name: 'forged GRANTED with ambiguous dim throws AMBIGUOUS_FORCED_GRANTED',
        expected: 'AMBIGUOUS_FORCED_GRANTED',
        run: () => {
          const granted = certifyDeployment({ evidence: cleanEvidence() });
          assertCertificationAmbiguityPreserved({
            ...granted,
            ambiguity: {
              missingEvidence: ['CHAOS_CONTAINMENT'],
              unresolvedDimensions: ['CHAOS_CONTAINMENT'],
            },
          });
        },
      },
    ];

    for (const c of cases) {
      let caught: unknown = null;
      try {
        c.run();
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(DeploymentCertificationError);
      const err = caught as DeploymentCertificationError;
      expect(err.code).toBe('DEPLOYMENT_CERTIFICATION_VIOLATION');
      expect(KNOWN_VIOLATIONS).toContain(err.violation);
      expect(err.violation).toBe(c.expected);
    }
  });
});

describe('CI gate — certificationId is deterministic and unique', () => {
  it('produces unique ids for distinct (evidence, dimensions) tuples', () => {
    const variants: CertificationEvidence[] = [
      cleanEvidence(),
      cleanEvidence({ chaosModesPassed: 4 }),
      cleanEvidence({ rolloutPartialAdoptionResiliencePct: 70 }),
      cleanEvidence({ replayPartialSurvivabilityPct: 91 }),
      cleanEvidence({ configHashDeterministic: false }),
    ];
    const certs = variants.map((evidence) =>
      certifyDeployment({ evidence, certifiedAt: '2026-05-10T00:00:00.000Z' }),
    );
    const ids = certs.map((c) => c.certificationId);
    expect(new Set(ids).size).toBe(ids.length);

    // Reproducibility — same evidence twice yields same id.
    expect(
      certifyDeployment({
        evidence: variants[0],
        certifiedAt: '2026-05-10T00:00:00.000Z',
      }).certificationId,
    ).toBe(ids[0]);
  });

  it('certificationDigest matches the certificationId of certifyDeployment', () => {
    const e = cleanEvidence();
    const cert = certifyDeployment({
      evidence: e,
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    expect(certificationDigest({ evidence: e, dimensions: cert.dimensions })).toBe(
      cert.certificationId,
    );
  });
});

describe('CI gate — silent-collapse never permitted', () => {
  it('every-null evidence never produces CERT_GRANTED', () => {
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
    expect(cert.verdict).not.toBe('CERT_GRANTED');
    expect(cert.verdict).toBe('CERT_AMBIGUOUS');
  });

  it('a CERT_AMBIGUOUS record carries a non-empty missingEvidence list', () => {
    const cert = certifyDeployment({
      evidence: cleanEvidence({
        lineageDriftCode: null,
        deploymentManifestId: null,
      }),
    });
    expect(cert.ambiguity.missingEvidence.length).toBeGreaterThan(0);
    expect(cert.ambiguity.missingEvidence).toContain('LINEAGE_INTEGRITY');
  });
});

describe('CI gate — drift report is order-independent + deterministic', () => {
  it('reordering certifications produces identical driftDigest', () => {
    const a = certifyDeployment({
      evidence: cleanEvidence(),
      certifiedAt: '2026-05-09T00:00:00.000Z',
    });
    const b = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 92 }),
      certifiedAt: '2026-05-10T00:00:00.000Z',
    });
    const c = certifyDeployment({
      evidence: cleanEvidence({ replayPartialSurvivabilityPct: 88 }),
      certifiedAt: '2026-05-10T01:00:00.000Z',
    });
    const forward = trackCertificationDrift({ certifications: [a, b, c] });
    const reversed = trackCertificationDrift({ certifications: [c, b, a] });
    const shuffled = trackCertificationDrift({ certifications: [b, a, c] });
    expect(forward.driftDigest).toBe(reversed.driftDigest);
    expect(forward.driftDigest).toBe(shuffled.driftDigest);
  });
});

describe('CI gate — surface board metrics', () => {
  it('emits a [cert-board] line per scenario', () => {
    const granted = certifyDeployment({ evidence: cleanEvidence() });
    const denied = certifyDeployment({
      evidence: cleanEvidence({ lineageDriftCode: 'DRIFT-CODE-TAMPER' }),
    });
    const ambiguous = certifyDeployment({
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
    for (const cert of [granted, denied, ambiguous]) {
      // eslint-disable-next-line no-console
      console.log(
        `[cert-board] verdict=${cert.verdict} score=${cert.score.toFixed(3)} certificationId=${cert.certificationId.slice(0, 12)} missing=${cert.ambiguity.missingEvidence.length}`,
      );
    }
    expect([granted.verdict, denied.verdict, ambiguous.verdict]).toEqual([
      'CERT_GRANTED',
      'CERT_DENIED',
      'CERT_AMBIGUOUS',
    ]);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

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
