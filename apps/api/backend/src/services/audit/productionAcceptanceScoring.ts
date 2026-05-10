/**
 * productionAcceptanceScoring.ts — Institutional Production Acceptance Scoring
 *
 * Scores a production deployment bundle against acceptance criteria derived
 * from institutional readiness requirements. Outputs an evidence-derived
 * acceptance score — never qualitative, never asserted without evidence.
 *
 * Design constraints:
 *   - Fail-closed: absent or ambiguous evidence floors the score to zero
 *   - No claimed percentage may exceed its evidence ceiling
 *   - Ambiguity is preserved, not resolved through optimism
 *   - Score is reproducible: same inputs always produce the same score
 */

import { createHash } from 'crypto';

// ── Score axes ─────────────────────────────────────────────────────────────────

export type AcceptanceDimension =
  | 'INSTITUTIONAL_READINESS'
  | 'REPLAY_PRODUCTION_FIDELITY'
  | 'CONFIDENCE_INTEGRITY'
  | 'DEPLOYMENT_SURVIVABILITY'
  | 'ACCEPTANCE_MATURITY';

export type AcceptanceVerdict =
  | 'ACCEPTED'
  | 'CONDITIONAL'
  | 'DEFERRED'
  | 'REJECTED';

export type EvidenceGrade = 'HIGH' | 'MEDIUM' | 'LOW' | 'ABSENT';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface AcceptanceCriterionEvidence {
  criterionId: string;
  dimension: AcceptanceDimension;
  evidenceGrade: EvidenceGrade;
  evidenceSource: string;
  evidenceTimestamp: string;
  passingThreshold: number;          // 0–100
  rawScore: number;                  // 0–100; caller-supplied from evidence
  ambiguous: boolean;
  ambiguityReason: string | null;
  notes: string | null;
}

export interface ProductionAcceptanceScoringInput {
  deploymentId: string;
  bundleVersion: string;
  institutionId: string;
  criteria: AcceptanceCriterionEvidence[];
  replaySafe: boolean;
  failClosed: boolean;               // must be true for institutional deployments
  scoredAt: string;
}

// ── Output ────────────────────────────────────────────────────────────────────

export interface DimensionScore {
  dimension: AcceptanceDimension;
  score: number;                     // 0–100 evidence-capped
  evidenceCeiling: number;           // max achievable given evidence
  passingCriteria: number;
  failingCriteria: number;
  ambiguousCriteria: number;
  absentCriteria: number;
  verdict: AcceptanceVerdict;
}

export interface AcceptanceScoringResult {
  schema: 'https://vitalcv.com/acceptance-scoring/v1';
  scoringVersion: '1.0';
  deploymentId: string;
  bundleVersion: string;
  institutionId: string;
  dimensions: DimensionScore[];
  compositeScore: number;            // weighted average across dimensions
  compositeVerdict: AcceptanceVerdict;
  replaySafe: boolean;
  failClosedEnforced: boolean;
  ambiguityPreserved: boolean;
  scoringFingerprint: string;        // deterministic SHA-256 of inputs
  scoredAt: string;
}

// ── Dimension weights ──────────────────────────────────────────────────────────

const DIMENSION_WEIGHTS: Record<AcceptanceDimension, number> = {
  INSTITUTIONAL_READINESS:   0.25,
  REPLAY_PRODUCTION_FIDELITY: 0.25,
  CONFIDENCE_INTEGRITY:      0.20,
  DEPLOYMENT_SURVIVABILITY:  0.20,
  ACCEPTANCE_MATURITY:       0.10,
};

// ── Acceptance thresholds ─────────────────────────────────────────────────────

const ACCEPTANCE_THRESHOLDS = {
  ACCEPTED:    85,
  CONDITIONAL: 65,
  DEFERRED:    45,
  // < 45 → REJECTED
} as const;

// ── Evidence ceiling map ──────────────────────────────────────────────────────

const EVIDENCE_GRADE_CEILING: Record<EvidenceGrade, number> = {
  HIGH:   100,
  MEDIUM:  75,
  LOW:     45,
  ABSENT:   0,
};

// ── Exported sentinels ────────────────────────────────────────────────────────

export const PRODUCTION_ACCEPTANCE_SENTINELS = {
  FAIL_CLOSED_REQUIRED: 'FAIL_CLOSED_REQUIRED',
  ABSENT_EVIDENCE_FLOOR: 'ABSENT_EVIDENCE_FLOOR',
  AMBIGUITY_PRESERVED: 'AMBIGUITY_PRESERVED',
  REPLAY_UNSAFE_REJECTION: 'REPLAY_UNSAFE_REJECTION',
} as const;

export const KNOWN_ACCEPTANCE_VERDICTS: AcceptanceVerdict[] = [
  'ACCEPTED', 'CONDITIONAL', 'DEFERRED', 'REJECTED',
];

// ── Scoring engine ────────────────────────────────────────────────────────────

function scoreVerdict(score: number): AcceptanceVerdict {
  if (score >= ACCEPTANCE_THRESHOLDS.ACCEPTED)    return 'ACCEPTED';
  if (score >= ACCEPTANCE_THRESHOLDS.CONDITIONAL) return 'CONDITIONAL';
  if (score >= ACCEPTANCE_THRESHOLDS.DEFERRED)    return 'DEFERRED';
  return 'REJECTED';
}

function computeDimensionScore(
  dimension: AcceptanceDimension,
  criteria: AcceptanceCriterionEvidence[],
  failClosed: boolean,
): DimensionScore {
  const matching = criteria.filter(c => c.dimension === dimension);

  if (matching.length === 0) {
    return {
      dimension,
      score: failClosed ? 0 : 0,
      evidenceCeiling: 0,
      passingCriteria: 0,
      failingCriteria: 0,
      ambiguousCriteria: 0,
      absentCriteria: 0,
      verdict: 'REJECTED',
    };
  }

  let totalCapped = 0;
  let totalCeiling = 0;
  let passingCriteria = 0;
  let failingCriteria = 0;
  let ambiguousCriteria = 0;
  let absentCriteria = 0;

  for (const c of matching) {
    const ceiling = EVIDENCE_GRADE_CEILING[c.evidenceGrade];
    const capped = c.evidenceGrade === 'ABSENT' ? 0 : Math.min(c.rawScore, ceiling);

    totalCeiling += ceiling;
    totalCapped += c.ambiguous ? Math.min(capped, ceiling * 0.6) : capped;

    if (c.evidenceGrade === 'ABSENT')    absentCriteria++;
    else if (c.ambiguous)                ambiguousCriteria++;
    else if (capped >= c.passingThreshold) passingCriteria++;
    else                                   failingCriteria++;
  }

  const avgCeiling = totalCeiling / matching.length;
  const avgScore   = totalCapped  / matching.length;

  // Fail-closed: any absent evidence floors the whole dimension
  const finalScore = (failClosed && absentCriteria > 0) ? 0 : avgScore;

  return {
    dimension,
    score: Math.round(finalScore),
    evidenceCeiling: Math.round(avgCeiling),
    passingCriteria,
    failingCriteria,
    ambiguousCriteria,
    absentCriteria,
    verdict: scoreVerdict(Math.round(finalScore)),
  };
}

function buildScoringFingerprint(input: ProductionAcceptanceScoringInput): string {
  const stable = {
    deploymentId: input.deploymentId,
    bundleVersion: input.bundleVersion,
    institutionId: input.institutionId,
    replaySafe: input.replaySafe,
    failClosed: input.failClosed,
    criteriaIds: input.criteria.map(c => c.criterionId).sort(),
    rawScores: input.criteria.map(c => c.rawScore).sort((a, b) => a - b),
  };
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function scoreProductionAcceptance(
  input: ProductionAcceptanceScoringInput,
): AcceptanceScoringResult {
  if (!input.failClosed) {
    // Institutional deployments must be fail-closed; open deployments are rejected
    return {
      schema: 'https://vitalcv.com/acceptance-scoring/v1',
      scoringVersion: '1.0',
      deploymentId: input.deploymentId,
      bundleVersion: input.bundleVersion,
      institutionId: input.institutionId,
      dimensions: [],
      compositeScore: 0,
      compositeVerdict: 'REJECTED',
      replaySafe: input.replaySafe,
      failClosedEnforced: false,
      ambiguityPreserved: true,
      scoringFingerprint: buildScoringFingerprint(input),
      scoredAt: input.scoredAt,
    };
  }

  if (!input.replaySafe) {
    // Replay-unsafe deployments cannot pass acceptance for institutional use
    return {
      schema: 'https://vitalcv.com/acceptance-scoring/v1',
      scoringVersion: '1.0',
      deploymentId: input.deploymentId,
      bundleVersion: input.bundleVersion,
      institutionId: input.institutionId,
      dimensions: [],
      compositeScore: 0,
      compositeVerdict: 'REJECTED',
      replaySafe: false,
      failClosedEnforced: true,
      ambiguityPreserved: true,
      scoringFingerprint: buildScoringFingerprint(input),
      scoredAt: input.scoredAt,
    };
  }

  const dimensions = (Object.keys(DIMENSION_WEIGHTS) as AcceptanceDimension[]).map(dim =>
    computeDimensionScore(dim, input.criteria, input.failClosed),
  );

  const compositeScore = Math.round(
    dimensions.reduce((acc, d) => {
      const weight = DIMENSION_WEIGHTS[d.dimension];
      return acc + (d.score * weight);
    }, 0),
  );

  const hasAmbiguous = input.criteria.some(c => c.ambiguous);

  return {
    schema: 'https://vitalcv.com/acceptance-scoring/v1',
    scoringVersion: '1.0',
    deploymentId: input.deploymentId,
    bundleVersion: input.bundleVersion,
    institutionId: input.institutionId,
    dimensions,
    compositeScore,
    compositeVerdict: scoreVerdict(compositeScore),
    replaySafe: input.replaySafe,
    failClosedEnforced: true,
    ambiguityPreserved: hasAmbiguous,
    scoringFingerprint: buildScoringFingerprint(input),
    scoredAt: input.scoredAt,
  };
}
