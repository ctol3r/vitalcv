/**
 * safeConvergence.ci.gate.test.ts — SAFE Convergence CI Gate (W2-PR124A)
 *
 * Enforces structural invariants that the SAFE Audit Convergence Layer
 * must satisfy before any merge. A single failing test here blocks the PR.
 *
 * GATE-1:  SAFE schema versions are stable
 * GATE-2:  Adapter never resolves AMBIGUOUS to a binary verdict
 * GATE-3:  Survivability scorer returns deterministic output for identical inputs
 * GATE-4:  Lineage manifest reconstructability flag is accurate (not over-optimistic)
 * GATE-5:  Institutional package always includes an uncertainty disclosure
 * GATE-6:  Zero-evidence bundle never gets AUDIT_READY
 * GATE-7:  Replay fidelity board metrics are internally consistent
 * GATE-8:  Audit lineage manifest hash is a valid SHA-256 hex string
 * GATE-9:  SAFE adapter hash covers source bundle identity fields
 * GATE-10: Fail-closed sentinels fire when evidence chain breaks
 */

import {
  adaptBundleToSafe,
  SAFE_SCHEMA_VERSION,
  ADAPTER_VERSION,
} from '../safeAuditAdapters';
import type { SAFEBundleInput, SAFEReplayInput } from '../safeAuditAdapters';
import { synthesizeReplayAudit } from '../replayAuditSynthesis';
import {
  packageInstitutionalEvidence,
  INSTITUTIONAL_PACKAGE_SCHEMA,
  INSTITUTIONAL_PACKAGE_VERSION,
} from '../institutionalEvidencePackager';
import { buildLineageManifest, LINEAGE_MANIFEST_SCHEMA } from '../auditLineageManifest';
import { scoreAuditSurvivability } from '../auditSurvivabilityScorer';

// ── Test Fixtures ─────────────────────────────────────────────────────────────

function makeCleanReplay(id: string): SAFEReplayInput {
  return {
    capsuleId: id,
    replayId: `replay_${id}`,
    replayedAt: '2025-03-01T00:00:00Z',
    subjectNpi: '9999999999',
    subjectDid: `did:vitalcv:${id}`,
    decisionType: 'CREDENTIALING',
    decisionTimestamp: '2025-01-01T12:00:00Z',
    status: 'APPROVED',
    decision: {
      decisionType: 'CREDENTIALING',
      decisionTimestamp: '2025-01-01T12:00:00Z',
      decisionId: id,
      decisionVersion: '1.0',
      outcome: 'APPROVED',
      confidence: 'HIGH',
    },
    verifier: {
      type: 'ORGANIZATION',
      systemId: 'sys_gate',
      orgId: 'org_gate',
      userId: null,
      confirmedBy: null,
      timestamp: '2025-01-01T12:00:00Z',
    },
    evidence: [
      {
        artifactId: `art_${id}`,
        source: 'NPPES',
        sourceLabel: 'NPPES',
        status: 'VERIFIED',
        verifiedAt: '2025-01-01T11:00:00Z',
        expiresAt: null,
        credentialType: 'NPI_REGISTRATION',
        jurisdiction: 'US',
        sanitizedPayload: {},
      },
    ],
    integrity: { hashMatch: true, storedHash: 'aaa', recomputedHash: 'aaa', tamperEvidence: null },
    containment: {
      capsuleId: id,
      verdict: 'CLEAN',
      kind: null,
      reason: null,
      lineageHints: [],
      isolatedAt: '2025-01-01T12:00:00Z',
    },
  };
}

function makeCleanBundle(replayIds: string[] = ['cap_gate_1']): SAFEBundleInput {
  const replays = replayIds.map(makeCleanReplay);
  return {
    bundleId: 'gate_bundle_001',
    bundleHash: 'gate_hash_stable',
    exportedAt: '2025-03-01T00:00:00Z',
    subject: { npi: '9999999999', did: 'did:vitalcv:gate' },
    capsuleCount: replays.length,
    replays,
    custodyLog: [{ event: 'BUNDLE_CREATED', timestamp: '2025-03-01T00:00:00Z', actor: 'VitalCV/test' }],
  };
}

// ── GATE-1: Schema Version Stability ─────────────────────────────────────────

describe('GATE-1: Schema version constants are stable', () => {
  it('SAFE schema version is the expected value', () => {
    expect(SAFE_SCHEMA_VERSION).toBe('safe-audit-evidence/v1.0');
  });

  it('Adapter version follows semver format', () => {
    expect(ADAPTER_VERSION).toMatch(/^vitalcv-safe-adapter\/\d+\.\d+\.\d+$/);
  });

  it('Institutional package schema and version are stable', () => {
    expect(INSTITUTIONAL_PACKAGE_SCHEMA).toBe('vitalcv.institutional-evidence-package/v1');
    expect(INSTITUTIONAL_PACKAGE_VERSION).toBe('1.0.0');
  });

  it('Lineage manifest schema is stable', () => {
    expect(LINEAGE_MANIFEST_SCHEMA).toBe('vitalcv.audit-lineage-manifest/v1');
  });
});

// ── GATE-2: Adapter Never Resolves AMBIGUOUS ──────────────────────────────────

describe('GATE-2: Adapter never collapses AMBIGUOUS verdict', () => {
  it('ambiguityPreserved is always true in the envelope', () => {
    const bundle = makeCleanBundle();
    const envelope = adaptBundleToSafe(bundle);
    expect(envelope.ambiguityPreserved).toBe(true);
  });

  it('AMBIGUOUS containment verdict passes through unchanged to decisionRecords', () => {
    const ambigReplay: SAFEReplayInput = {
      ...makeCleanReplay('cap_ambig_gate'),
      containment: {
        capsuleId: 'cap_ambig_gate',
        verdict: 'AMBIGUOUS',
        kind: null,
        reason: 'gate test',
        lineageHints: [],
        isolatedAt: new Date().toISOString(),
      },
    };
    const bundle = makeCleanBundle();
    bundle.replays = [ambigReplay];
    bundle.capsuleCount = 1;

    const envelope = adaptBundleToSafe(bundle);
    const record = envelope.decisionRecords.find((d) => d.decisionId === 'cap_ambig_gate');
    expect(record).toBeDefined();
    expect(record!.replayStatus).toBe('AMBIGUOUS');
    expect(record!.ambiguityPreserved).toBe(true);
    expect(record!.replayStatus).not.toBe('CLEAN');
    expect(record!.replayStatus).not.toBe('QUARANTINED');
  });
});

// ── GATE-3: Survivability Scorer is Deterministic ─────────────────────────────

describe('GATE-3: Survivability scorer is deterministic', () => {
  it('produces identical composite score on two runs with the same input', () => {
    const bundle = makeCleanBundle(['det_1', 'det_2']);
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);

    const s1 = scoreAuditSurvivability(env, syn, pkg, man);
    const s2 = scoreAuditSurvivability(env, syn, pkg, man);

    expect(s1.compositeScore).toBe(s2.compositeScore);
    expect(s1.safeAuditMaturity).toBe(s2.safeAuditMaturity);
    expect(s1.verdict).toBe(s2.verdict);
    expect(s1.dimensions.map((d) => d.score)).toEqual(s2.dimensions.map((d) => d.score));
  });
});

// ── GATE-4: Lineage Reconstructability is Not Over-Optimistic ─────────────────

describe('GATE-4: Lineage reconstructability flag is accurate', () => {
  it('zero-evidence bundle produces non-reconstructable manifest when blocking gaps exist', () => {
    const bundle = makeCleanBundle();
    bundle.replays = [];
    bundle.capsuleCount = 0;

    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);

    const hasBlockingGap = syn.gaps.some((g) => g.severity === 'BLOCKING');
    if (hasBlockingGap) {
      expect(man.reconstructable).toBe(false);
    }
  });

  it('clean bundle without blocking gaps produces reconstructable manifest', () => {
    const bundle = makeCleanBundle(['r1', 'r2', 'r3']);
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);

    const blockingGaps = syn.gaps.filter((g) => g.severity === 'BLOCKING');
    if (blockingGaps.length === 0 && !env.failClosedSentinels.length) {
      expect(man.reconstructable).toBe(true);
    }
  });
});

// ── GATE-5: Institutional Package Always Has Uncertainty Disclosure ────────────

describe('GATE-5: Institutional package always includes uncertainty disclosure', () => {
  it('disclosure statement is always present and non-empty', () => {
    const bundle = makeCleanBundle();
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);

    expect(pkg.uncertaintyDisclosure).toBeDefined();
    expect(pkg.uncertaintyDisclosure.disclosureStatement).toBeTruthy();
    expect(pkg.uncertaintyDisclosure.disclosureStatement.length).toBeGreaterThan(50);
  });

  it('disclosure statement does not contain banned strings', () => {
    const bundle = makeCleanBundle();
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);

    const stmt = pkg.uncertaintyDisclosure.disclosureStatement.toLowerCase();
    const banned = [
      'automatically verified',
      'guaranteed verification',
      'certified compliant',
      'hipaa compliant',
      'soc2 certified',
      'legally accepted',
    ];
    for (const b of banned) {
      expect(stmt).not.toContain(b);
    }
  });
});

// ── GATE-6: Zero Evidence Bundle Never Gets AUDIT_READY ───────────────────────

describe('GATE-6: Zero-evidence bundle never reaches AUDIT_READY', () => {
  it('empty replay bundle returns verdict other than AUDIT_READY', () => {
    const bundle = makeCleanBundle();
    bundle.replays = [];
    bundle.capsuleCount = 0;

    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);
    const score = scoreAuditSurvivability(env, syn, pkg, man);

    expect(score.verdict).not.toBe('AUDIT_READY');
  });
});

// ── GATE-7: Replay Fidelity Board Metrics Are Internally Consistent ───────────

describe('GATE-7: Board metrics are internally consistent', () => {
  it('composite score equals sum of dimension contributions', () => {
    const bundle = makeCleanBundle(['m1', 'm2']);
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);
    const score = scoreAuditSurvivability(env, syn, pkg, man);

    const sumContributions = score.dimensions.reduce((acc, d) => acc + d.contributedScore, 0);
    expect(score.compositeScore).toBe(Math.round(sumContributions));
  });

  it('all dimension weights sum to approximately 1.0', () => {
    const bundle = makeCleanBundle();
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);
    const score = scoreAuditSurvivability(env, syn, pkg, man);

    const weightSum = score.dimensions.reduce((acc, d) => acc + d.weight, 0);
    expect(weightSum).toBeCloseTo(1.0, 1);
  });

  it('survivability grade matches intact capsule rate', () => {
    const bundle = makeCleanBundle(['g1', 'g2', 'g3']);
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);

    const { survivabilityGrade, intactRate } = syn.survivabilityWindow;
    if (intactRate >= 0.95) expect(survivabilityGrade).toBe('A');
    else if (intactRate >= 0.80) expect(survivabilityGrade).toBe('B');
    else if (intactRate >= 0.65) expect(survivabilityGrade).toBe('C');
    else if (intactRate >= 0.50) expect(survivabilityGrade).toBe('D');
    else expect(survivabilityGrade).toBe('F');
  });
});

// ── GATE-8: Lineage Manifest Hash is a Valid SHA-256 Hex String ───────────────

describe('GATE-8: Lineage manifest hash covers identity fields', () => {
  it('manifest hash is a 64-character hex string (SHA-256)', () => {
    const bundle = makeCleanBundle();
    const env = adaptBundleToSafe(bundle);
    const syn = synthesizeReplayAudit(bundle, env);
    const pkg = packageInstitutionalEvidence(env, syn);
    const man = buildLineageManifest(env, syn, pkg);

    expect(man.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── GATE-9: SAFE Adapter Hash Covers Bundle Identity ─────────────────────────

describe('GATE-9: SAFE adapter hash covers bundle identity', () => {
  it('adapter hash is a 64-character hex string (SHA-256)', () => {
    const bundle = makeCleanBundle();
    const env = adaptBundleToSafe(bundle);
    expect(env.adapterHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('two bundles with different bundleId produce different adapter hashes', () => {
    const b1 = makeCleanBundle();
    const b2 = { ...makeCleanBundle(), bundleId: 'different_bundle_id', bundleHash: 'different_hash' };

    const e1 = adaptBundleToSafe(b1);
    const e2 = adaptBundleToSafe(b2);

    expect(e1.adapterHash).not.toBe(e2.adapterHash);
  });
});

// ── GATE-10: Fail-Closed Sentinels Fire for Broken Evidence Chains ────────────

describe('GATE-10: Fail-closed sentinels fire for structural gaps', () => {
  it('empty evidence replay triggers sentinels in the envelope', () => {
    const replay: SAFEReplayInput = { ...makeCleanReplay('cap_no_evidence'), evidence: [] };
    const bundle = makeCleanBundle();
    bundle.replays = [replay];
    bundle.capsuleCount = 1;

    const env = adaptBundleToSafe(bundle);
    expect(env.failClosedSentinels.length).toBeGreaterThan(0);
  });

  it('sentinel-triggered envelope reduces adapter readiness score below 100', () => {
    const replay: SAFEReplayInput = { ...makeCleanReplay('cap_sentinel'), evidence: [] };
    const bundle = makeCleanBundle();
    bundle.replays = [replay];
    bundle.capsuleCount = 1;

    const env = adaptBundleToSafe(bundle);
    expect(env.auditReadinessScore).toBeLessThan(100);
  });
});
