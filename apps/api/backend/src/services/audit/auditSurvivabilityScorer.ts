/**
 * auditSurvivabilityScorer.ts — Audit Survivability Scoring Engine (W2-PR124A)
 *
 * Multi-dimensional scoring of how well the VitalCV audit trail survives
 * various failure modes that external SAFE-style audits probe for:
 *
 *   Dimension 1 — Replay Integrity (can we reconstruct any past decision?)
 *   Dimension 2 — Evidence Continuity (is there a gap-free evidence chain?)
 *   Dimension 3 — Lineage Reconstructability (can we trace any item to origin?)
 *   Dimension 4 — Ambiguity Saturation (are ambiguous verdicts explicitly surfaced?)
 *   Dimension 5 — Temporal Coverage (how far back does the intact record reach?)
 *   Dimension 6 — Institutional Readiness (is the package fit for institutional use?)
 *
 * Each dimension scores 0–100. The composite SAFE audit maturity score weights
 * them by criticality.
 *
 * Design contract: pure function — takes snapshot structs, returns scores.
 * No DB access. No network calls. Deterministic given the same inputs.
 */

import type { SafeEvidenceEnvelope } from './safeAuditAdapters';
import type { ReplayAuditSynthesis } from './replayAuditSynthesis';
import type { InstitutionalEvidencePackage } from './institutionalEvidencePackager';
import type { AuditLineageManifest } from './auditLineageManifest';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SurvivabilityScore {
  schema: 'vitalcv.survivability-score/v1';
  scoredAt: string;
  dimensions: SurvivabilityDimension[];
  compositeScore: number;         // 0–100 weighted composite
  safeAuditMaturity: SAFEMaturityLevel;
  verdict: 'AUDIT_READY' | 'CONDITIONALLY_READY' | 'NEEDS_REMEDIATION' | 'NOT_READY';
  remediationItems: RemediationItem[];
  dimensionWeights: DimensionWeights;
}

export interface SurvivabilityDimension {
  name: DimensionName;
  score: number;         // 0–100
  weight: number;        // 0–1, used in composite
  contributedScore: number;   // score * weight
  findings: string[];
  passFail: 'PASS' | 'WARN' | 'FAIL';
}

export type DimensionName =
  | 'REPLAY_INTEGRITY'
  | 'EVIDENCE_CONTINUITY'
  | 'LINEAGE_RECONSTRUCTABILITY'
  | 'AMBIGUITY_SATURATION'
  | 'TEMPORAL_COVERAGE'
  | 'INSTITUTIONAL_READINESS';

export type SAFEMaturityLevel = 'L0_NONE' | 'L1_BASIC' | 'L2_STRUCTURED' | 'L3_VERIFIABLE' | 'L4_AUDITABLE';

export interface RemediationItem {
  priority: 'P0' | 'P1' | 'P2';
  dimension: DimensionName;
  finding: string;
  action: string;
}

export interface DimensionWeights {
  REPLAY_INTEGRITY: number;
  EVIDENCE_CONTINUITY: number;
  LINEAGE_RECONSTRUCTABILITY: number;
  AMBIGUITY_SATURATION: number;
  TEMPORAL_COVERAGE: number;
  INSTITUTIONAL_READINESS: number;
}

const DEFAULT_WEIGHTS: DimensionWeights = {
  REPLAY_INTEGRITY:           0.25,
  EVIDENCE_CONTINUITY:        0.20,
  LINEAGE_RECONSTRUCTABILITY: 0.20,
  AMBIGUITY_SATURATION:       0.15,
  TEMPORAL_COVERAGE:          0.10,
  INSTITUTIONAL_READINESS:    0.10,
};

// ── Main Scorer ───────────────────────────────────────────────────────────────

export function scoreAuditSurvivability(
  safeEnvelope: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  institutionalPackage: InstitutionalEvidencePackage,
  lineageManifest: AuditLineageManifest,
  weights: Partial<DimensionWeights> = {},
): SurvivabilityScore {
  const scoredAt = new Date().toISOString();
  const effectiveWeights = { ...DEFAULT_WEIGHTS, ...weights };

  const dimensions: SurvivabilityDimension[] = [
    scoreReplayIntegrity(synthesis, effectiveWeights.REPLAY_INTEGRITY),
    scoreEvidenceContinuity(safeEnvelope, synthesis, effectiveWeights.EVIDENCE_CONTINUITY),
    scoreLineageReconstructability(lineageManifest, effectiveWeights.LINEAGE_RECONSTRUCTABILITY),
    scoreAmbiguitySaturation(safeEnvelope, synthesis, effectiveWeights.AMBIGUITY_SATURATION),
    scoreTemporalCoverage(synthesis, effectiveWeights.TEMPORAL_COVERAGE),
    scoreInstitutionalReadiness(institutionalPackage, safeEnvelope, effectiveWeights.INSTITUTIONAL_READINESS),
  ];

  const compositeScore = Math.round(
    dimensions.reduce((acc, d) => acc + d.contributedScore, 0),
  );

  const safeAuditMaturity = maturityFromScore(compositeScore);
  const verdict = verdictFromScore(compositeScore, dimensions);
  const remediationItems = collectRemediationItems(dimensions);

  return {
    schema: 'vitalcv.survivability-score/v1',
    scoredAt,
    dimensions,
    compositeScore,
    safeAuditMaturity,
    verdict,
    remediationItems,
    dimensionWeights: effectiveWeights,
  };
}

// ── Dimension Scorers ─────────────────────────────────────────────────────────

function scoreReplayIntegrity(
  synthesis: ReplayAuditSynthesis,
  weight: number,
): SurvivabilityDimension {
  const sw = synthesis.survivabilityWindow;
  const findings: string[] = [];
  let score = 100;

  // Intact rate
  if (sw.intactRate < 1.0) {
    const deficit = Math.round((1 - sw.intactRate) * 100);
    score -= deficit * 0.5;
    findings.push(`${deficit}% of capsules not clean (grade ${sw.survivabilityGrade})`);
  }

  // Containment breaches
  const breaches = synthesis.survivabilityWindow.notes.filter((n) =>
    n.includes('CONTAINMENT_BREACH'),
  ).length;
  if (breaches > 0) {
    score -= 20;
    findings.push(`${breaches} containment breach(es) detected`);
  }

  // Synthesis integrity
  if (!synthesis.synthesisIntegrity.hashChainIntact) {
    score -= 10;
    findings.push('Synthesis hash chain broken');
  }

  // Blocking gaps
  const blockingGaps = synthesis.gaps.filter((g) => g.severity === 'BLOCKING').length;
  if (blockingGaps > 0) {
    score -= blockingGaps * 5;
    findings.push(`${blockingGaps} blocking synthesis gap(s)`);
  }

  score = clamp(score);
  return makeDimension('REPLAY_INTEGRITY', score, weight, findings);
}

function scoreEvidenceContinuity(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  weight: number,
): SurvivabilityDimension {
  const findings: string[] = [];
  let score = 100;

  // Evidence items present
  if (!env.evidenceItems.length) {
    return makeDimension('EVIDENCE_CONTINUITY', 0, weight, ['No evidence items in SAFE envelope']);
  }

  // Integrity breaches
  const hashMismatches = env.evidenceItems.filter((i) => i.integrity === 'HASH_MISMATCH').length;
  if (hashMismatches > 0) {
    score -= hashMismatches * 8;
    findings.push(`${hashMismatches} evidence item(s) with hash mismatch`);
  }

  // Sentinel items
  const sentinels = env.evidenceItems.filter((i) => i.safeClass === 'SENTINEL').length;
  if (sentinels > 0) {
    score -= sentinels * 4;
    findings.push(`${sentinels} sentinel item(s) — structural gaps in evidence chain`);
  }

  // Temporal drift
  if (synthesis.temporalDriftReport.driftCount > 0) {
    const criticalDrifts = synthesis.temporalDriftReport.driftEvents.filter(
      (d) => d.severity === 'CRITICAL',
    ).length;
    score -= criticalDrifts * 10 + (synthesis.temporalDriftReport.driftCount - criticalDrifts) * 3;
    findings.push(`${synthesis.temporalDriftReport.driftCount} temporal drift event(s) including ${criticalDrifts} critical`);
  }

  // Fail-closed sentinels
  score -= env.failClosedSentinels.length * 2;
  if (env.failClosedSentinels.length > 0) {
    findings.push(`${env.failClosedSentinels.length} fail-closed sentinel(s) triggered`);
  }

  score = clamp(score);
  return makeDimension('EVIDENCE_CONTINUITY', score, weight, findings);
}

function scoreLineageReconstructability(
  manifest: AuditLineageManifest,
  weight: number,
): SurvivabilityDimension {
  const findings: string[] = [];
  let score = manifest.summary.integrityScore;

  if (!manifest.reconstructable) {
    findings.push(`${manifest.summary.blockingGaps} blocking gap(s) prevent full reconstruction`);
  }
  if (manifest.summary.brokenChains > 0) {
    findings.push(`${manifest.summary.brokenChains} isolated node(s) with no lineage edges`);
  }
  if (manifest.summary.totalEdges === 0) {
    score = 0;
    findings.push('No lineage edges — derivation chain is entirely absent');
  }

  score = clamp(score);
  if (!findings.length) findings.push(`${manifest.summary.totalNodes} nodes, ${manifest.summary.totalEdges} edges fully connected`);
  return makeDimension('LINEAGE_RECONSTRUCTABILITY', score, weight, findings);
}

function scoreAmbiguitySaturation(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  weight: number,
): SurvivabilityDimension {
  const findings: string[] = [];
  let score = 100;

  // Ambiguity saturation: GOOD to surface ambiguity explicitly
  // We penalize for *undetected* ambiguity that isn't surfaced
  const ambiguityRate = synthesis.ambiguityQuantification.ambiguityRate;
  const unresolvedCount = synthesis.ambiguityQuantification.unresolvedAmbiguities.length;

  // If ambiguity exists but envelope doesn't show ambiguityPreserved = true → penalty
  if (!env.ambiguityPreserved && ambiguityRate > 0) {
    score -= 30;
    findings.push('Ambiguity present but envelope.ambiguityPreserved is false — saturation gap');
  }

  // High ambiguity rate is expected to surface (not penalized) but extreme rates warn
  if (ambiguityRate > 0.5) {
    score -= 15;
    findings.push(`${Math.round(ambiguityRate * 100)}% ambiguity rate — majority of decisions unresolvable`);
  } else if (ambiguityRate > 0.2) {
    score -= 5;
    findings.push(`${Math.round(ambiguityRate * 100)}% ambiguity rate — elevated`);
  }

  // Unresolved ambiguities that are explicitly listed: GOOD
  if (unresolvedCount > 0) {
    findings.push(`${unresolvedCount} ambiguous decision(s) explicitly listed — saturation intact`);
  } else if (ambiguityRate === 0 && synthesis.ambiguityQuantification.totalDecisions > 0) {
    findings.push('Zero ambiguous decisions — full resolution or no ambiguity surfaced');
  }

  score = clamp(score);
  return makeDimension('AMBIGUITY_SATURATION', score, weight, findings);
}

function scoreTemporalCoverage(
  synthesis: ReplayAuditSynthesis,
  weight: number,
): SurvivabilityDimension {
  const findings: string[] = [];
  let score = 100;

  const sw = synthesis.survivabilityWindow;

  if (!sw.windowStart || !sw.windowEnd) {
    return makeDimension('TEMPORAL_COVERAGE', 0, weight, ['No timestamped decisions — coverage window unknown']);
  }

  const windowStart = new Date(sw.windowStart);
  const windowEnd = new Date(sw.windowEnd);
  const coverageDays = Math.round(
    (windowEnd.getTime() - windowStart.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (coverageDays === 0) {
    score = 40;
    findings.push('All decisions share the same date — no longitudinal coverage');
  } else if (coverageDays < 30) {
    score = 60;
    findings.push(`${coverageDays}-day coverage window — below 30-day institutional minimum`);
  } else if (coverageDays < 90) {
    score = 80;
    findings.push(`${coverageDays}-day coverage window — below 90-day preferred threshold`);
  } else {
    findings.push(`${coverageDays}-day coverage window — meets longitudinal threshold`);
  }

  if (!sw.oldestIntactTimestamp) {
    score -= 10;
    findings.push('Oldest intact capsule timestamp is unknown');
  }

  score = clamp(score);
  return makeDimension('TEMPORAL_COVERAGE', score, weight, findings);
}

function scoreInstitutionalReadiness(
  pkg: InstitutionalEvidencePackage,
  env: SafeEvidenceEnvelope,
  weight: number,
): SurvivabilityDimension {
  const findings: string[] = [];
  let score = 100;

  const fidelity = pkg.auditIntegrity.replayFidelityScore;
  if (fidelity < 60) {
    score -= 30;
    findings.push(`Replay fidelity ${fidelity}/100 below institutional threshold (60)`);
  } else if (fidelity < 80) {
    score -= 10;
    findings.push(`Replay fidelity ${fidelity}/100 — acceptable but below optimal (80)`);
  } else {
    findings.push(`Replay fidelity ${fidelity}/100 — meets institutional threshold`);
  }

  const uncertaintyWarnings = pkg.uncertaintyDisclosure.warningLabels;
  if (uncertaintyWarnings.includes('BLOCKING_SYNTHESIS_GAPS')) {
    score -= 20;
    findings.push('Blocking synthesis gaps in uncertainty disclosure');
  }
  if (uncertaintyWarnings.includes('ELEVATED_AMBIGUITY')) {
    score -= 10;
    findings.push('Elevated ambiguity flagged in institutional package');
  }

  if (pkg.auditIntegrity.containmentBreaches > 0) {
    score -= 15;
    findings.push(`${pkg.auditIntegrity.containmentBreaches} containment breach(es) in institutional record`);
  }

  // Adapter readiness
  if (env.auditReadinessScore < 70) {
    score -= 10;
    findings.push(`SAFE adapter readiness ${env.auditReadinessScore}/100 below threshold`);
  }

  score = clamp(score);
  return makeDimension('INSTITUTIONAL_READINESS', score, weight, findings);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDimension(
  name: DimensionName,
  score: number,
  weight: number,
  findings: string[],
): SurvivabilityDimension {
  const passFail: SurvivabilityDimension['passFail'] =
    score >= 80 ? 'PASS' : score >= 55 ? 'WARN' : 'FAIL';
  return {
    name,
    score,
    weight,
    contributedScore: Math.round(score * weight),
    findings,
    passFail,
  };
}

function clamp(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function maturityFromScore(score: number): SAFEMaturityLevel {
  if (score >= 90) return 'L4_AUDITABLE';
  if (score >= 75) return 'L3_VERIFIABLE';
  if (score >= 55) return 'L2_STRUCTURED';
  if (score >= 30) return 'L1_BASIC';
  return 'L0_NONE';
}

function verdictFromScore(
  score: number,
  dimensions: SurvivabilityDimension[],
): SurvivabilityScore['verdict'] {
  const hasFail = dimensions.some((d) => d.passFail === 'FAIL');
  if (score >= 80 && !hasFail) return 'AUDIT_READY';
  if (score >= 60) return 'CONDITIONALLY_READY';
  if (score >= 40) return 'NEEDS_REMEDIATION';
  return 'NOT_READY';
}

function collectRemediationItems(
  dimensions: SurvivabilityDimension[],
): RemediationItem[] {
  const items: RemediationItem[] = [];

  for (const dim of dimensions) {
    if (dim.passFail === 'FAIL') {
      for (const finding of dim.findings) {
        items.push({
          priority: dim.score < 40 ? 'P0' : 'P1',
          dimension: dim.name,
          finding,
          action: remediationAction(dim.name, finding),
        });
      }
    } else if (dim.passFail === 'WARN') {
      for (const finding of dim.findings) {
        items.push({
          priority: 'P2',
          dimension: dim.name,
          finding,
          action: remediationAction(dim.name, finding),
        });
      }
    }
  }

  return items.sort((a, b) => a.priority.localeCompare(b.priority));
}

function remediationAction(dim: DimensionName, finding: string): string {
  if (dim === 'REPLAY_INTEGRITY') {
    if (finding.includes('containment breach')) return 'Investigate and quarantine breached capsules; re-run replay with containment boundary enforcement';
    if (finding.includes('gap')) return 'Resolve synthesis blocking gaps before submitting to external audit';
    return 'Review replay engine containment configuration';
  }
  if (dim === 'EVIDENCE_CONTINUITY') {
    if (finding.includes('hash mismatch')) return 'Audit artifact hash computation path for tampering or storage corruption';
    if (finding.includes('sentinel')) return 'Trace sentinel origins; confirm whether evidence gaps are structural or recoverable';
    if (finding.includes('drift')) return 'Review credential status transitions for unexpected status reversals';
    return 'Review evidence chain for continuity gaps';
  }
  if (dim === 'LINEAGE_RECONSTRUCTABILITY') {
    if (finding.includes('isolated')) return 'Ensure all derivation transforms register their edge in the lineage manifest';
    if (finding.includes('blocking')) return 'Resolve blocking gaps before lineage manifest is submitted for audit';
    return 'Add missing lineage edges for all derivation transforms';
  }
  if (dim === 'AMBIGUITY_SATURATION') {
    if (finding.includes('ambiguityPreserved')) return 'Set ambiguityPreserved: true in SAFE adapter output; never resolve AMBIGUOUS verdicts silently';
    return 'Ensure all AMBIGUOUS decisions are listed in unresolvedAmbiguities';
  }
  if (dim === 'TEMPORAL_COVERAGE') {
    return 'Extend replay window to cover ≥90 days of decision history';
  }
  if (dim === 'INSTITUTIONAL_READINESS') {
    if (finding.includes('fidelity')) return 'Improve capsule integrity rate to raise replay fidelity score above 80';
    if (finding.includes('containment')) return 'Resolve containment breaches before packaging for institutional submission';
    return 'Address all blocking uncertainty disclosures in the institutional package';
  }
  return 'Review and remediate the identified audit gap';
}
