/**
 * safeChaosSim.test.ts — SAFE Chaos Simulation Suite (W2-PR124A)
 *
 * Simulates failure modes that external SAFE-style audits probe for:
 *   - Capsule hash drift (tampered evidence)
 *   - Partial bundle failures (missing capsules mid-stream)
 *   - Containment breach propagation
 *   - Ambiguity collapse (audit suppressing AMBIGUOUS verdicts)
 *   - Sentinel chain breaks (fail-closed path)
 *   - Zero-evidence bundles
 *   - All-quarantine bundles
 *
 * Each test asserts that the system:
 *   - Does NOT silently pass corrupt evidence
 *   - Surfaces ambiguity explicitly (never resolves to binary)
 *   - Preserves containment signals through the adapter/synthesis/package chain
 *   - Produces deterministic output (same input → same score)
 */

import { adaptBundleToSafe } from '../safeAuditAdapters';
import type { SAFEBundleInput, SAFEReplayInput, SAFEContainmentRecord } from '../safeAuditAdapters';
import { synthesizeReplayAudit } from '../replayAuditSynthesis';
import { packageInstitutionalEvidence } from '../institutionalEvidencePackager';
import { buildLineageManifest } from '../auditLineageManifest';
import { scoreAuditSurvivability } from '../auditSurvivabilityScorer';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReplay(
  capsuleId: string,
  overrides: Partial<SAFEReplayInput> = {},
): SAFEReplayInput {
  return {
    capsuleId,
    replayId: `replay_${capsuleId}`,
    replayedAt: new Date().toISOString(),
    subjectNpi: '1234567890',
    subjectDid: `did:vitalcv:${capsuleId}`,
    decisionType: 'EMPLOYMENT',
    decisionTimestamp: '2025-01-15T10:00:00Z',
    status: 'APPROVED',
    decision: {
      decisionType: 'EMPLOYMENT',
      decisionTimestamp: '2025-01-15T10:00:00Z',
      decisionId: capsuleId,
      decisionVersion: '1.0',
      outcome: 'APPROVED',
      confidence: 'HIGH',
    },
    verifier: {
      type: 'ORGANIZATION',
      systemId: 'sys_test',
      orgId: 'org_test',
      userId: null,
      confirmedBy: null,
      timestamp: '2025-01-15T10:00:00Z',
    },
    evidence: [
      {
        artifactId: `art_${capsuleId}_1`,
        source: 'NPPES',
        sourceLabel: 'NPPES Registry',
        status: 'VERIFIED',
        verifiedAt: '2025-01-15T09:00:00Z',
        expiresAt: null,
        credentialType: 'NPI_REGISTRATION',
        jurisdiction: 'US',
        sanitizedPayload: {},
      },
    ],
    integrity: {
      hashMatch: true,
      storedHash: 'abc123',
      recomputedHash: 'abc123',
      tamperEvidence: null,
    },
    containment: {
      capsuleId,
      verdict: 'CLEAN',
      kind: null,
      reason: null,
      lineageHints: [],
      isolatedAt: '2025-01-15T10:00:00Z',
    },
    ...overrides,
  };
}

function makeBundle(
  replays: SAFEReplayInput[],
  overrides: Partial<SAFEBundleInput> = {},
): SAFEBundleInput {
  return {
    bundleId: `bundle_test_${Date.now()}`,
    bundleHash: 'deadbeef',
    exportedAt: new Date().toISOString(),
    subject: { npi: '1234567890', did: 'did:vitalcv:test' },
    capsuleCount: replays.length,
    replays,
    custodyLog: [
      { event: 'BUNDLE_CREATED', timestamp: new Date().toISOString(), actor: 'VitalCV/test' },
    ],
    ...overrides,
  };
}

function makeContainment(capsuleId: string, verdict: string, overrides: Partial<SAFEContainmentRecord> = {}): SAFEContainmentRecord {
  return {
    capsuleId,
    verdict,
    kind: null,
    reason: null,
    lineageHints: [],
    isolatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── Chaos Scenario 1: Zero Evidence Bundle ────────────────────────────────────

describe('SAFE Chaos Sim — Zero Evidence Bundle', () => {
  it('fails closed and surfaces gaps rather than passing empty evidence as clean', () => {
    const bundle = makeBundle([]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);
    const score = scoreAuditSurvivability(envelope, synthesis, pkg, manifest);

    expect(envelope.evidenceItems).toHaveLength(0);
    expect(synthesis.gaps.length).toBeGreaterThan(0);
    expect(synthesis.gaps.some((g) => g.severity === 'BLOCKING')).toBe(true);
    expect(score.verdict).not.toBe('AUDIT_READY');
    expect(score.compositeScore).toBeLessThan(80);
  });

  it('marks lineage manifest as non-reconstructable when no evidence exists', () => {
    const bundle = makeBundle([]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);

    const decisionNodes = manifest.nodes.filter((n) => n.kind === 'REPLAY_RECORD');
    expect(decisionNodes).toHaveLength(0);
  });
});

// ── Chaos Scenario 2: Hash-Drifted (Tampered) Evidence ───────────────────────

describe('SAFE Chaos Sim — Hash-Drifted Evidence', () => {
  it('surfaces hash mismatch through the full adapter → synthesis → score chain', () => {
    const tamperedReplay = makeReplay('cap_tampered', {
      integrity: {
        hashMatch: false,
        storedHash: 'abc123',
        recomputedHash: 'deadbeef',
        tamperEvidence: 'Hash drift detected in artifact storage',
      },
    });
    const bundle = makeBundle([tamperedReplay]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);
    const score = scoreAuditSurvivability(envelope, synthesis, pkg, manifest);

    expect(score.compositeScore).toBeLessThan(100);
  });

  it('does not silently pass tampered evidence as AUDIT_READY without CLEAN replay', () => {
    const tamperedReplay = makeReplay('cap_t2', {
      integrity: { hashMatch: false, storedHash: '111', recomputedHash: '222', tamperEvidence: 'drift' },
      containment: makeContainment('cap_t2', 'QUARANTINED', { kind: 'STRUCTURAL_CORRUPTION', reason: 'Hash drift' }),
    });
    const bundle = makeBundle([tamperedReplay]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);
    const score = scoreAuditSurvivability(envelope, synthesis, pkg, manifest);

    expect(score.verdict).not.toBe('AUDIT_READY');
  });
});

// ── Chaos Scenario 3: All-Quarantine Bundle ───────────────────────────────────

describe('SAFE Chaos Sim — All Quarantined Capsules', () => {
  it('produces NOT_READY or NEEDS_REMEDIATION verdict when all replays are quarantined', () => {
    const quarantinedReplays = ['cap_q1', 'cap_q2', 'cap_q3'].map((id) =>
      makeReplay(id, {
        containment: makeContainment(id, 'QUARANTINED', { kind: 'STRUCTURAL_CORRUPTION', reason: 'Simulated quarantine' }),
      }),
    );
    const bundle = makeBundle(quarantinedReplays);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);
    const score = scoreAuditSurvivability(envelope, synthesis, pkg, manifest);

    // All-quarantine must never reach AUDIT_READY
    expect(score.verdict).not.toBe('AUDIT_READY');
    // Replay integrity must fail for all-quarantine
    const replayIntegrityDim = score.dimensions.find((d) => d.name === 'REPLAY_INTEGRITY')!;
    expect(replayIntegrityDim.passFail).toBe('FAIL');
    expect(['A', 'B']).not.toContain(synthesis.survivabilityWindow.survivabilityGrade);
  });

  it('lists all quarantined capsule IDs in ambiguity quantification', () => {
    const ids = ['cap_q1', 'cap_q2'];
    const quarantinedReplays = ids.map((id) =>
      makeReplay(id, {
        containment: makeContainment(id, 'QUARANTINED', { kind: 'STRUCTURAL_CORRUPTION', reason: 'test' }),
      }),
    );
    const bundle = makeBundle(quarantinedReplays);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);

    expect(synthesis.ambiguityQuantification.quarantinedDecisions).toBe(2);
    expect(synthesis.ambiguityQuantification.cleanDecisions).toBe(0);
  });
});

// ── Chaos Scenario 4: Ambiguity Must Not Be Collapsed ─────────────────────────

describe('SAFE Chaos Sim — Ambiguity Preservation', () => {
  it('preserves AMBIGUOUS verdict through adapter without resolving it', () => {
    const ambiguousReplay = makeReplay('cap_ambig', {
      containment: makeContainment('cap_ambig', 'AMBIGUOUS', { reason: 'Simulated ambiguity' }),
    });
    const bundle = makeBundle([ambiguousReplay]);
    const envelope = adaptBundleToSafe(bundle);

    expect(envelope.ambiguityPreserved).toBe(true);

    const ambiguousDecision = envelope.decisionRecords.find(
      (d) => d.decisionId === 'cap_ambig',
    );
    expect(ambiguousDecision).toBeDefined();
    expect(ambiguousDecision!.replayStatus).toBe('AMBIGUOUS');
    expect(ambiguousDecision!.ambiguityPreserved).toBe(true);
    expect(ambiguousDecision!.replayStatus).not.toBe('CLEAN');
    expect(ambiguousDecision!.replayStatus).not.toBe('QUARANTINED');
  });

  it('lists unresolved ambiguous capsule IDs in synthesis — never resolves them', () => {
    const ids = ['cap_a1', 'cap_a2'];
    const ambiguousReplays = ids.map((id) =>
      makeReplay(id, {
        containment: makeContainment(id, 'AMBIGUOUS', { reason: 'test' }),
      }),
    );
    const bundle = makeBundle(ambiguousReplays);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);

    expect(synthesis.ambiguityQuantification.unresolvedAmbiguities).toHaveLength(2);
    expect(synthesis.ambiguityQuantification.unresolvedAmbiguities).toContain('cap_a1');
    expect(synthesis.ambiguityQuantification.unresolvedAmbiguities).toContain('cap_a2');
    expect(synthesis.ambiguityQuantification.ambiguityRate).toBeCloseTo(1.0);
  });

  it('institutional package discloses unresolved ambiguities', () => {
    const ambiguousReplay = makeReplay('cap_ambig2', {
      containment: makeContainment('cap_ambig2', 'AMBIGUOUS', { reason: 'test' }),
    });
    const bundle = makeBundle([ambiguousReplay]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);

    expect(pkg.uncertaintyDisclosure.unresolvedItems).toBeGreaterThan(0);
    expect(pkg.uncertaintyDisclosure.warningLabels).toContain('UNRESOLVED_AMBIGUOUS_DECISIONS');
  });
});

// ── Chaos Scenario 5: Containment Breach Propagation ─────────────────────────

describe('SAFE Chaos Sim — Containment Breach Propagation', () => {
  it('surfaces containment breach through all layers and flags it in survivability', () => {
    const breachedReplay = makeReplay('cap_breach', {
      containment: makeContainment('cap_breach', 'CONTAINMENT_BREACH', {
        kind: 'STRUCTURAL_CORRUPTION',
        reason: 'Simulated containment breach',
        lineageHints: ['cap_downstream'],
      }),
    });
    const cleanReplay = makeReplay('cap_clean');
    const bundle = makeBundle([breachedReplay, cleanReplay]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);
    const score = scoreAuditSurvivability(envelope, synthesis, pkg, manifest);

    expect(synthesis.survivabilityWindow.notes.some((n) =>
      n.toLowerCase().includes('breach'),
    )).toBe(true);
    expect(pkg.auditIntegrity.containmentBreaches).toBeGreaterThan(0);

    const replayDim = score.dimensions.find((d) => d.name === 'REPLAY_INTEGRITY')!;
    expect(replayDim.score).toBeLessThan(100);
    expect(score.verdict).not.toBe('AUDIT_READY');
  });
});

// ── Chaos Scenario 6: Fail-Closed Sentinel Chain ─────────────────────────────

describe('SAFE Chaos Sim — Fail-Closed Sentinels', () => {
  it('surfaces fail-closed sentinels in envelope and penalizes readiness score', () => {
    const noEvidenceReplay = makeReplay('cap_noevid', { evidence: [] });
    const bundle = makeBundle([noEvidenceReplay]);
    const envelope = adaptBundleToSafe(bundle);

    expect(envelope.failClosedSentinels.length).toBeGreaterThan(0);
    expect(envelope.auditReadinessScore).toBeLessThan(100);
  });

  it('sentinel nodes appear in lineage manifest gaps', () => {
    const noEvidenceReplay = makeReplay('cap_noevid2', { evidence: [] });
    const bundle = makeBundle([noEvidenceReplay]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg = packageInstitutionalEvidence(envelope, synthesis);
    const manifest = buildLineageManifest(envelope, synthesis, pkg);

    const sentinelNodes = manifest.nodes.filter((n) => n.kind === 'SENTINEL');
    const gapsWithSentinels = manifest.gaps.filter((g) =>
      g.affectedNodeIds.some((id) => id.startsWith('sentinel:')),
    );

    if (envelope.failClosedSentinels.length > 0) {
      expect(sentinelNodes.length).toBeGreaterThan(0);
      expect(gapsWithSentinels.length).toBeGreaterThan(0);
    }
  });
});

// ── Chaos Scenario 7: Determinism ─────────────────────────────────────────────

describe('SAFE Chaos Sim — Determinism', () => {
  it('produces identical adapter hash for the same bundle', () => {
    const replay = makeReplay('cap_det');
    const bundle = makeBundle([replay], { bundleId: 'det_bundle', bundleHash: 'det_hash' });

    const env1 = adaptBundleToSafe(bundle);
    const env2 = adaptBundleToSafe(bundle);

    expect(env1.adapterHash).toBe(env2.adapterHash);
  });

  it('produces identical survivability score for the same inputs', () => {
    const replay = makeReplay('cap_det2');
    const bundle = makeBundle([replay], { bundleId: 'det_bundle2', bundleHash: 'det_hash2' });
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);
    const pkg1 = packageInstitutionalEvidence(envelope, synthesis);
    const pkg2 = packageInstitutionalEvidence(envelope, synthesis);
    const manifest1 = buildLineageManifest(envelope, synthesis, pkg1);
    const manifest2 = buildLineageManifest(envelope, synthesis, pkg2);
    const score1 = scoreAuditSurvivability(envelope, synthesis, pkg1, manifest1);
    const score2 = scoreAuditSurvivability(envelope, synthesis, pkg2, manifest2);

    expect(score1.compositeScore).toBe(score2.compositeScore);
    expect(score1.safeAuditMaturity).toBe(score2.safeAuditMaturity);
    expect(score1.verdict).toBe(score2.verdict);
  });
});

// ── Chaos Scenario 8: Mixed-Health Bundle ────────────────────────────────────

describe('SAFE Chaos Sim — Mixed Health Bundle', () => {
  it('correctly classifies a mixed clean/quarantined/ambiguous bundle', () => {
    const cleanReplay = makeReplay('cap_clean');
    const quarantinedReplay = makeReplay('cap_quarantine', {
      containment: makeContainment('cap_quarantine', 'QUARANTINED', { kind: 'STRUCTURAL_CORRUPTION', reason: 'test' }),
    });
    const ambiguousReplay = makeReplay('cap_ambiguous', {
      containment: makeContainment('cap_ambiguous', 'AMBIGUOUS', { reason: 'test' }),
    });

    const bundle = makeBundle([cleanReplay, quarantinedReplay, ambiguousReplay]);
    const envelope = adaptBundleToSafe(bundle);
    const synthesis = synthesizeReplayAudit(bundle, envelope);

    expect(synthesis.ambiguityQuantification.cleanDecisions).toBe(1);
    expect(synthesis.ambiguityQuantification.quarantinedDecisions).toBe(1);
    expect(synthesis.ambiguityQuantification.ambiguousDecisions).toBe(1);
    expect(synthesis.ambiguityQuantification.ambiguityRate).toBeCloseTo(1 / 3);
    expect(synthesis.survivabilityWindow.intactCapsules).toBe(1);
    expect(synthesis.survivabilityWindow.totalCapsules).toBe(3);
    expect(synthesis.survivabilityWindow.intactRate).toBeCloseTo(1 / 3);
    expect(synthesis.survivabilityWindow.survivabilityGrade).toBe('F');
  });
});
