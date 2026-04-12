/**
 * trustScoreV1.ts — Trust Score V1
 *
 * VitalCV's composite trust scoring engine. Not workflow automation —
 * this is computed, multi-source, explainable provider trust.
 *
 * Score architecture:
 *   8 dimensions → 0–100 composite → trust band (L0–L3) → explanation payload
 *
 * Methodology version: trust-score/v1.0
 * Bump TRUST_SCORE_VERSION when weighting changes.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { computeTrustFreshness, type ClaimFreshnessReport } from '../identity/freshnessModel';
import { detectDivergence, type DivergenceReport } from '../identity/divergenceEngine';
import type { TrustBand } from './trustStateEngine';

export const TRUST_SCORE_VERSION = 'trust-score/v1.0';

// ── Dimension weights (must sum to 100) ───────────────────────────────────────
//
// Philosophy: exclusion/sanctions and licensure carry the most weight because
// they represent the hardest legal and safety facts. Identity anchors
// everything. Coverage rewards breadth. Freshness rewards ongoing diligence.
//
export const DIMENSION_WEIGHTS = {
  identity:     15,  // NPI identity confirmed by authoritative source
  licensure:    25,  // Active, current, un-expired state licenses
  exclusion:    20,  // OIG/LEIE/SAM clean — highest business risk if wrong
  enrollment:   10,  // CMS Medicare/Medicaid enrollment status
  boardCert:    10,  // ABMS/AOA board certification
  coverage:     10,  // Gold-source coverage breadth (rewards diligence)
  freshness:    7,   // Recency of verification (decays with age)
  academic:     3,   // Publication/research identity (AMC/academic context)
  // NOTE: contradiction penalties are SUBTRACTED from the total, not a dimension
} as const;

export type DimensionKey = keyof typeof DIMENSION_WEIGHTS;

export type DimensionStatus =
  | 'VERIFIED'       // Confirmed from authoritative Gold source
  | 'ACTIVE'         // Status is positive/active
  | 'CLEAR'          // Exclusion/sanction clear
  | 'ENROLLED'       // CMS enrollment active
  | 'CERTIFIED'      // Board certification active
  | 'PARTIAL'        // Some evidence but not complete
  | 'STALE'          // Evidence exists but exceeds freshness SLA
  | 'AGING'          // Evidence exists, approaching SLA
  | 'FRESH'          // Evidence exists and is fresh
  | 'UNKNOWN'        // No data available — cannot award credit
  | 'UNVERIFIED'     // Data present but not confirmed from authoritative source
  | 'EXPIRED'        // License/cert has expired
  | 'EXCLUDED'       // Active OIG/LEIE/SAM exclusion
  | 'NOT_CHECKED'    // Source gated or skipped
  | 'LAPSED';        // Board cert lapsed

export interface DimensionScore {
  score:       number;           // Points earned (0–max)
  max:         number;           // Maximum possible points
  pct:         number;           // score/max * 100
  status:      DimensionStatus;  // Human-readable verdict
  sources:     string[];         // Source IDs that contributed
  confidence:  number;           // 0.0–1.0 confidence in this dimension
  explanation: string;           // One sentence, factual
  gaps:        string[];         // What's missing or degraded
  capped?:     string;           // Reason if score was capped below max
}

export interface ContradictionRecord {
  severity:    'HIGH' | 'MEDIUM' | 'LOW';
  dimension:   DimensionKey;
  description: string;
  penalty:     number;           // Points deducted from total
  sources:     string[];         // Conflicting sources
  claimType:   string;
  resolvedAt?: string;
}

export interface TrustScoreV1 {
  // Identity
  npi:              string;
  methodology:      string;          // 'trust-score/v1.0'
  computedAt:       string;

  // Composite
  score:            number;          // 0–100
  band:             TrustBand;       // L0–L3
  bandLabel:        string;          // 'UNVERIFIED' | 'PARTIAL' | 'CREDENTIALED' | 'VERIFIED'
  confidence:       number;          // 0.0–1.0 weighted aggregate

  // Dimension breakdown
  dimensions:       Record<DimensionKey, DimensionScore>;

  // Penalties
  contradictions:   ContradictionRecord[];
  totalPenalty:     number;
  penaltyApplied:   boolean;

  // Summary
  gaps:             string[];        // Top 5 gaps limiting the score
  trustLimits:      string[];        // Specific caps/blocks active
  recommendations:  string[];        // Actionable next steps

  // Freshness snapshot
  freshnessReport?: ClaimFreshnessReport;

  // Divergence
  divergenceReport?: DivergenceReport;
}

// ── Band thresholds ────────────────────────────────────────────────────────────
//
// L3 requires: ≥80 pts, exclusion=CLEAR, no HIGH contradictions
// L2 requires: ≥60 pts, exclusion != EXCLUDED
// L1 requires: ≥40 pts
// L0: anything else
//
function deriveBandFromScore(
  score: number,
  exclusionStatus: DimensionStatus,
  hasBlockingContradiction: boolean,
): { band: TrustBand; label: string } {
  if (exclusionStatus === 'EXCLUDED') {
    return { band: 'L0', label: 'EXCLUDED' };
  }
  if (hasBlockingContradiction) {
    return { band: 'L1', label: 'REVIEW_REQUIRED' };
  }
  if (score >= 80 && exclusionStatus === 'CLEAR') {
    return { band: 'L3', label: 'VERIFIED' };
  }
  if (score >= 60) {
    return { band: 'L2', label: 'CREDENTIALED' };
  }
  if (score >= 40) {
    return { band: 'L1', label: 'PARTIAL' };
  }
  return { band: 'L0', label: 'UNVERIFIED' };
}

// Weight helper — cast to plain number to avoid literal-type narrowing issues
function w(n: number): number { return n; }

// ── Dimension scorers ─────────────────────────────────────────────────────────

function scoreIdentity(artifacts: ArtifactSummary[]): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.identity);
  const nppsArtifact = artifacts.find(a =>
    a.source === 'NPPES_API' || a.source === 'NPPES_BULK' || a.source === 'IDENTITY_INDEX',
  );

  if (!nppsArtifact) {
    return {
      score: 0, max: MAX, pct: 0, status: 'UNKNOWN',
      sources: [], confidence: 0,
      explanation: 'NPI identity not verified — NPPES lookup not completed.',
      gaps: ['NPI identity not verified'],
    };
  }

  const ageHours = (Date.now() - nppsArtifact.verifiedAt.getTime()) / 3_600_000;
  const isStale = ageHours > 720; // 30 days
  const score = isStale ? Math.round(MAX * 0.75) : MAX;

  return {
    score, max: MAX, pct: Math.round(score / MAX * 100),
    status: isStale ? 'STALE' : 'VERIFIED',
    sources: [nppsArtifact.source],
    confidence: isStale ? 0.75 : 0.99,
    explanation: isStale
      ? `NPI identity verified by ${nppsArtifact.source} ${Math.round(ageHours / 24)}d ago — refreshing recommended.`
      : `NPI identity confirmed by ${nppsArtifact.source} as authoritative government source.`,
    gaps: isStale ? ['NPPES identity data aging — refresh recommended'] : [],
    capped: isStale ? `Identity data ${Math.round(ageHours / 24)}d old` : undefined,
  };
}

function scoreLicensure(artifacts: ArtifactSummary[]): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.licensure);

  const licenseArts = artifacts.filter(a =>
    a.source === 'PECOS_PUBLIC' || a.source === 'NURSYS' ||
    a.source === 'STATE_BOARD' || a.source === 'NURSYS_ENOTIFY',
  );

  if (licenseArts.length === 0) {
    return {
      score: 0, max: MAX, pct: 0, status: 'UNKNOWN',
      sources: [], confidence: 0,
      explanation: 'No licensure verification completed — PECOS/state board not checked.',
      gaps: ['Licensure not verified', 'State board check pending'],
    };
  }

  const activeArts = licenseArts.filter(a => a.status === 'VERIFIED' || a.status === 'ACTIVE');
  const expiredArts = licenseArts.filter(a => a.status === 'EXPIRED' || a.status === 'REVOKED');
  const expiringArts = licenseArts.filter(a => {
    if (!a.expiresAt) return false;
    const daysUntil = (a.expiresAt.getTime() - Date.now()) / 86_400_000;
    return daysUntil > 0 && daysUntil < 30;
  });

  if (expiredArts.length > 0 && activeArts.length === 0) {
    return {
      score: 0, max: MAX, pct: 0, status: 'EXPIRED',
      sources: licenseArts.map(a => a.source),
      confidence: 0.9,
      explanation: 'One or more licenses verified as expired — no active license confirmed.',
      gaps: ['License expired — renewal required'],
    };
  }

  const oldestActive = Math.max(...activeArts.map(a =>
    (Date.now() - a.verifiedAt.getTime()) / 3_600_000,
  ));

  let score = MAX;
  let status: DimensionStatus = 'ACTIVE';
  const gaps: string[] = [];
  let capped: string | undefined;

  if (oldestActive > 720) { // >30 days
    score = Math.round(MAX * 0.65);
    status = 'STALE';
    gaps.push(`License data ${Math.round(oldestActive / 24)}d old — re-verification recommended`);
    capped = `Licensure data stale (${Math.round(oldestActive / 24)}d)`;
  } else if (oldestActive > 168) { // >7 days
    score = Math.round(MAX * 0.85);
    status = 'AGING';
    capped = `Licensure data aging (${Math.round(oldestActive / 24)}d)`;
  }

  if (expiringArts.length > 0) {
    score = Math.round(score * 0.85);
    gaps.push('License expiring within 30 days');
    capped = (capped ?? '') + ' + expiry warning';
  }

  return {
    score, max: MAX, pct: Math.round(score / MAX * 100), status,
    sources: activeArts.map(a => a.source),
    confidence: activeArts.length > 1 ? 0.95 : 0.80,
    explanation: `${activeArts.length} active license(s) verified via ${[...new Set(activeArts.map(a => a.source))].join(', ')}.`,
    gaps, capped,
  };
}

function scoreExclusion(artifacts: ArtifactSummary[]): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.exclusion);

  const oigArt = artifacts.find(a => a.source === 'OIG_LEIE');
  const samArt = artifacts.find(a => a.source === 'SAM_GOV');

  if (!oigArt) {
    return {
      score: 0, max: MAX, pct: 0, status: 'NOT_CHECKED',
      sources: [], confidence: 0,
      explanation: 'OIG/LEIE exclusion check not completed — cannot award credit.',
      gaps: ['OIG/LEIE not checked', 'Exclusion status unknown'],
    };
  }

  // Check for active exclusion
  const excluded = oigArt.status === 'EXCLUDED' || samArt?.status === 'EXCLUDED';
  if (excluded) {
    return {
      score: 0, max: MAX, pct: 0, status: 'EXCLUDED',
      sources: [oigArt.source, samArt?.source].filter(Boolean) as string[],
      confidence: 0.98,
      explanation: 'CRITICAL: Active OIG/LEIE or SAM.gov exclusion detected.',
      gaps: ['EXCLUDED from federal healthcare programs'],
    };
  }

  // Unknown = OIG returned error/timeout
  if (oigArt.status === 'UNKNOWN' || oigArt.status === 'ERROR') {
    return {
      score: Math.round(MAX * 0.35), max: MAX, pct: 35, status: 'UNKNOWN',
      sources: [oigArt.source],
      confidence: 0.35,
      explanation: 'OIG/LEIE returned UNKNOWN — API error or timeout. Cannot confirm clean status.',
      gaps: ['Exclusion status could not be confirmed'],
      capped: 'OIG returned UNKNOWN',
    };
  }

  // Both clear = full credit
  const sources = [oigArt.source];
  const hasMultiSource = !!samArt && samArt.status !== 'EXCLUDED';
  if (hasMultiSource) sources.push(samArt!.source);

  const ageHours = (Date.now() - oigArt.verifiedAt.getTime()) / 3_600_000;
  const isStale = ageHours > 72; // OIG SLA = 24h; stale = 3x SLA
  const isAging = !isStale && ageHours > 24;

  let score = hasMultiSource ? MAX : Math.round(MAX * 0.88); // bonus for multi-source
  let status: DimensionStatus = 'CLEAR';
  const gaps: string[] = [];
  let capped: string | undefined;

  if (isStale) {
    score = Math.round(score * 0.55);
    status = 'STALE';
    gaps.push(`OIG data ${Math.round(ageHours)}h old — daily check required`);
    capped = `Exclusion check stale (${Math.round(ageHours)}h)`;
  } else if (isAging) {
    score = Math.round(score * 0.8);
    status = 'AGING';
    capped = `Exclusion check aging (${Math.round(ageHours)}h)`;
  }

  if (!hasMultiSource) {
    gaps.push('SAM.gov not checked — only OIG/LEIE verified');
  }

  return {
    score, max: MAX, pct: Math.round(score / MAX * 100), status,
    sources, confidence: hasMultiSource ? 0.97 : 0.88,
    explanation: `Exclusion status confirmed CLEAR via ${sources.join(', ')}.`,
    gaps, capped,
  };
}

function scoreEnrollment(artifacts: ArtifactSummary[]): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.enrollment);

  const pecosArt = artifacts.find(a => a.source === 'PECOS_PUBLIC');
  const dcArt    = artifacts.find(a => a.source === 'DOCTORS_CLINICIANS');

  if (!pecosArt && !dcArt) {
    return {
      score: Math.round(MAX * 0.3), max: MAX, pct: 30, status: 'UNKNOWN',
      sources: [], confidence: 0.3,
      explanation: 'CMS enrollment not verified — PECOS/D&C not checked.',
      gaps: ['PECOS enrollment not checked'],
    };
  }

  const enrolled = pecosArt?.status === 'ENROLLED' || dcArt?.status === 'ENROLLED';
  const sources = [pecosArt?.source, dcArt?.source].filter(Boolean) as string[];
  const hasMulti = sources.length > 1;

  if (!enrolled) {
    return {
      score: Math.round(MAX * 0.4), max: MAX, pct: 40, status: 'PARTIAL',
      sources, confidence: 0.6,
      explanation: 'CMS data checked but enrollment status not confirmed active.',
      gaps: ['Enrollment status inconclusive'],
    };
  }

  const newestArt = [pecosArt, dcArt]
    .filter(Boolean)
    .sort((a, b) => b!.verifiedAt.getTime() - a!.verifiedAt.getTime())[0]!;
  const ageHours = (Date.now() - newestArt.verifiedAt.getTime()) / 3_600_000;

  let score = hasMulti ? MAX : Math.round(MAX * 0.85);
  const gaps: string[] = [];

  if (ageHours > 2160) { // >90 days
    score = Math.round(score * 0.7);
    gaps.push('Enrollment data >90 days old');
  }
  if (!hasMulti) {
    gaps.push('Only one CMS source checked — consider PECOS + D&C');
  }

  return {
    score, max: MAX, pct: Math.round(score / MAX * 100), status: 'ENROLLED',
    sources, confidence: hasMulti ? 0.95 : 0.80,
    explanation: `Medicare/Medicaid enrollment confirmed via ${sources.join(' + ')}.`,
    gaps,
  };
}

function scoreBoardCert(artifacts: ArtifactSummary[]): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.boardCert);

  // ABMS is gated — check if we have any board cert evidence
  const boardArts = artifacts.filter(a =>
    a.source === 'ABMS' || a.source === 'AOA' || a.source === 'BOARD_CERT',
  );

  if (boardArts.length === 0) {
    // Board cert not checked — partial credit since ABMS is gated
    return {
      score: Math.round(MAX * 0.3), max: MAX, pct: 30, status: 'NOT_CHECKED',
      sources: [], confidence: 0.3,
      explanation: 'Board certification not verified — ABMS access gated. Partial credit held.',
      gaps: ['Board certification not verified (ABMS gated — institutional access required)'],
      capped: 'ABMS gated',
    };
  }

  const certified = boardArts.find(a => a.status === 'CERTIFIED' || a.status === 'VERIFIED');
  const lapsed = boardArts.find(a => a.status === 'LAPSED' || a.status === 'EXPIRED');

  if (lapsed && !certified) {
    return {
      score: Math.round(MAX * 0.15), max: MAX, pct: 15, status: 'LAPSED',
      sources: boardArts.map(a => a.source),
      confidence: 0.85,
      explanation: 'Board certification found but has lapsed — renewal required.',
      gaps: ['Board certification lapsed'],
    };
  }

  const ageHours = certified
    ? (Date.now() - certified.verifiedAt.getTime()) / 3_600_000
    : 0;
  const isStale = ageHours > 8760; // >1 year

  return {
    score: isStale ? Math.round(MAX * 0.65) : MAX,
    max: MAX, pct: isStale ? 65 : 100,
    status: isStale ? 'STALE' : 'CERTIFIED',
    sources: boardArts.map(a => a.source),
    confidence: 0.90,
    explanation: `Board certification verified${isStale ? ` (${Math.round(ageHours / 24)}d ago)` : ''}.`,
    gaps: isStale ? ['Board cert data >1 year old'] : [],
    capped: isStale ? 'Board cert data stale' : undefined,
  };
}

function scoreCoverage(
  artifacts: ArtifactSummary[],
  totalGoldSources: number,
): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.coverage);

  const checkedSources = new Set(artifacts.map(a => a.source));
  const goldSources = [
    'NPPES_API', 'NPPES_BULK', 'PECOS_PUBLIC', 'DOCTORS_CLINICIANS',
    'OIG_LEIE', 'OPEN_PAYMENTS', 'SAM_GOV',
  ];
  const goldChecked = goldSources.filter(s => checkedSources.has(s)).length;
  const coverageRatio = goldChecked / goldSources.length;
  const score = Math.round(MAX * coverageRatio);

  return {
    score, max: MAX, pct: Math.round(coverageRatio * 100),
    status: coverageRatio >= 0.85 ? 'VERIFIED' : coverageRatio >= 0.5 ? 'PARTIAL' : 'UNKNOWN',
    sources: goldSources.filter(s => checkedSources.has(s)),
    confidence: coverageRatio,
    explanation: `${goldChecked}/${goldSources.length} primary government sources checked.`,
    gaps: goldSources
      .filter(s => !checkedSources.has(s))
      .map(s => `${s} not checked`),
  };
}

function scoreFreshness(freshnessReport: ClaimFreshnessReport): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.freshness);
  const { overallFreshness, staleDimensions, agingDimensions } = freshnessReport;

  let score = MAX;
  const gaps: string[] = [];
  let status: DimensionStatus = 'FRESH';

  if (staleDimensions.length > 0) {
    score = Math.round(MAX * Math.max(0.1, 1 - staleDimensions.length * 0.25));
    status = 'STALE';
    for (const dim of staleDimensions) {
      gaps.push(`${dim.claimClass} verification stale (${Math.round(dim.ageHours / 24)}d old)`);
    }
  } else if (agingDimensions.length > 0) {
    score = Math.round(MAX * Math.max(0.55, 1 - agingDimensions.length * 0.12));
    status = 'AGING';
    for (const dim of agingDimensions) {
      gaps.push(`${dim.claimClass} approaching SLA (${Math.round(dim.ageHours)}h old)`);
    }
  }

  return {
    score, max: MAX, pct: Math.round(score / MAX * 100), status,
    sources: [],
    confidence: overallFreshness,
    explanation: staleDimensions.length > 0
      ? `${staleDimensions.length} claim class(es) exceed freshness SLA.`
      : agingDimensions.length > 0
        ? `${agingDimensions.length} claim class(es) approaching SLA.`
        : 'All verifications within freshness SLA.',
    gaps,
  };
}

// ── Academic dimension enrichment isolation guard ────────────────────────────
//
// TRUTH DOCTRINE ENFORCEMENT:
// Academic sources (OPENALEX, PUBMED, ORCID, CLINICAL_TRIALS) are
// ENRICHMENT-ONLY. They are NOT primary-source verification. Including
// them in the trust score would allow enrichment to influence trust.
//
// FIX: academic dimension is DISABLED by default (returns 0/NOT_CHECKED).
// It can be enabled via ACADEMIC_TRUST_SCORE_ENABLED=true ONLY when:
//   1. The academic identity is verified via a signed credential (not name-match)
//   2. The source has a proper verification artifact with receipt
//
// Current academic enrichment uses name-based matching (0.65 confidence) —
// this is not primary-source verification and MUST NOT affect trust score.
//
const ACADEMIC_TRUST_SCORE_ENABLED =
  process.env.ACADEMIC_TRUST_SCORE_ENABLED === 'true';

function scoreAcademic(artifacts: ArtifactSummary[]): DimensionScore {
  const MAX: number = w(DIMENSION_WEIGHTS.academic);

  // Guard: academic dimension disabled — returns NOT_CHECKED (0 score)
  // This prevents enrichment data from influencing the trust spine.
  if (!ACADEMIC_TRUST_SCORE_ENABLED) {
    return {
      score: 0, max: MAX, pct: 0, status: 'NOT_CHECKED',
      sources: [], confidence: 0,
      explanation: 'Academic identity dimension is not active. Academic context is provided as enrichment only — it does not affect trust score.',
      gaps: [],
    };
  }

  const academicArts = artifacts.filter(a =>
    a.source === 'OPENALEX' || a.source === 'PUBMED' ||
    a.source === 'CLINICAL_TRIALS' || a.source === 'ORCID',
  );

  if (academicArts.length === 0) {
    return {
      score: 0, max: MAX, pct: 0, status: 'UNKNOWN',
      sources: [], confidence: 0,
      explanation: 'No academic/research identity sources checked (ORCID, OpenAlex, PubMed).',
      gaps: ['Academic identity not verified'],
    };
  }

  const hasPublications = academicArts.some(a =>
    a.source === 'OPENALEX' || a.source === 'PUBMED',
  );
  const hasClinicalTrials = academicArts.some(a => a.source === 'CLINICAL_TRIALS');

  const score = hasPublications && hasClinicalTrials
    ? MAX
    : hasPublications
      ? Math.round(MAX * 0.8)
      : Math.round(MAX * 0.5);

  return {
    score, max: MAX, pct: Math.round(score / MAX * 100),
    status: score === MAX ? 'VERIFIED' : 'PARTIAL',
    sources: academicArts.map(a => a.source),
    confidence: 0.65, // Silver tier — name-based matching, not primary-source
    explanation: `Academic identity found via ${academicArts.map(a => a.source).join(', ')}. Note: name-match only.`,
    gaps: !hasPublications ? ['No publications found in OpenAlex/PubMed'] : [],
  };
}

// ── Contradiction penalty scorer ───────────────────────────────────────────────

function scoreContradictions(divergenceReport: DivergenceReport): ContradictionRecord[] {
  return divergenceReport.conflicts
    .filter((conflict) => conflict.active)
    .map(conflict => ({
    severity:    conflict.severity,
    dimension:   conflict.dimension as DimensionKey,
    description: conflict.description,
    penalty:     conflict.penalty,
    sources:     conflict.sources,
    claimType:   conflict.claimType,
    resolvedAt:  conflict.resolvedAt,
  }));
}

// ── Internal artifact summary ──────────────────────────────────────────────────

interface ArtifactSummary {
  source:     string;
  status:     string;
  verifiedAt: Date;
  expiresAt:  Date | null;
}

async function loadArtifacts(npi: string): Promise<ArtifactSummary[]> {
  const arts = await prisma.verificationArtifact.findMany({
    where: {
      npi,
      status: { not: 'REVOKED' },
    },
    orderBy: { verifiedAt: 'desc' },
    select: {
      source:      true,
      status:      true,
      verifiedAt:  true,
      expiresAt:   true,
    },
  });

  // Deduplicate: keep newest per source
  const seen = new Map<string, ArtifactSummary>();
  for (const art of arts) {
    if (!seen.has(art.source)) {
      seen.set(art.source, {
        source:     art.source,
        status:     art.status,
        verifiedAt: art.verifiedAt,
        expiresAt:  art.expiresAt,
      });
    }
  }
  return [...seen.values()];
}

// ── Main scoring function ──────────────────────────────────────────────────────

export async function computeTrustScoreV1(npi: string): Promise<TrustScoreV1> {
  const [artifacts, freshnessReport, divergenceReport] = await Promise.all([
    loadArtifacts(npi),
    computeTrustFreshness(npi),
    detectDivergence(npi),
  ]);

  const totalGoldSources = 7; // NPPES_API, NPPES_BULK, PECOS, D&C, OIG, OPEN_PAYMENTS, SAM_GOV

  // Score each dimension
  const identity  = scoreIdentity(artifacts);
  const licensure = scoreLicensure(artifacts);
  const exclusion = scoreExclusion(artifacts);
  const enrollment = scoreEnrollment(artifacts);
  const boardCert = scoreBoardCert(artifacts);
  const coverage  = scoreCoverage(artifacts, totalGoldSources);
  const freshness = scoreFreshness(freshnessReport);
  const academic  = scoreAcademic(artifacts);

  // Contradiction penalties
  const contradictions = scoreContradictions(divergenceReport);
  const totalPenalty = contradictions.reduce((sum, c) => sum + c.penalty, 0);

  // Composite score
  const rawScore = identity.score + licensure.score + exclusion.score +
    enrollment.score + boardCert.score + coverage.score +
    freshness.score + academic.score;
  const score = Math.max(0, Math.min(100, rawScore - totalPenalty));

  // Weighted confidence aggregate
  const confidence = (
    identity.confidence    * 0.15 +
    licensure.confidence   * 0.25 +
    exclusion.confidence   * 0.20 +
    enrollment.confidence  * 0.10 +
    boardCert.confidence   * 0.10 +
    coverage.confidence    * 0.10 +
    freshness.confidence   * 0.07 +
    academic.confidence    * 0.03
  );

  // Derive band
  const hasBlockingContradiction = contradictions.some(c => c.severity === 'HIGH');
  const { band, label: bandLabel } = deriveBandFromScore(score, exclusion.status, hasBlockingContradiction);

  // Aggregate gaps (prioritized)
  const gaps = [
    ...exclusion.gaps,
    ...licensure.gaps,
    ...enrollment.gaps,
    ...identity.gaps,
    ...boardCert.gaps,
    ...coverage.gaps.slice(0, 2),
    ...freshness.gaps.slice(0, 2),
  ].slice(0, 5);

  // Trust limits (score caps)
  const trustLimits: string[] = [];
  if (hasBlockingContradiction) trustLimits.push('Score band capped at L1: high-severity divergence detected');
  if (exclusion.status === 'UNKNOWN') trustLimits.push('Exclusion UNKNOWN: band capped at L1');
  if (exclusion.status === 'STALE') trustLimits.push('Exclusion data stale: re-check required');
  if (licensure.status === 'STALE') trustLimits.push('License data stale: may not reflect current status');

  // Recommendations
  const recommendations: string[] = [];
  if (exclusion.status === 'NOT_CHECKED' || exclusion.status === 'UNKNOWN') {
    recommendations.push('Run OIG/LEIE exclusion check — required for L2+ band');
  }
  if (licensure.score < DIMENSION_WEIGHTS.licensure * 0.7) {
    recommendations.push('Verify state medical license via PECOS or state board');
  }
  if (boardCert.status === 'NOT_CHECKED') {
    recommendations.push('Obtain ABMS institutional access for board certification verification');
  }
  if (coverage.pct < 60) {
    recommendations.push('Check more primary sources to improve coverage score');
  }
  if (freshness.status === 'STALE') {
    recommendations.push('Re-run identity ingestion — verification data exceeds SLA');
  }

  log('info', `[TrustScoreV1] NPI ${npi} scored ${score}/100 (${band}) penalties=${totalPenalty}`);

  return {
    npi,
    methodology:     TRUST_SCORE_VERSION,
    computedAt:      new Date().toISOString(),
    score,
    band,
    bandLabel,
    confidence:      Math.round(confidence * 100) / 100,
    dimensions: {
      identity, licensure, exclusion, enrollment,
      boardCert, coverage, freshness, academic,
    },
    contradictions,
    totalPenalty,
    penaltyApplied: totalPenalty > 0,
    gaps,
    trustLimits,
    recommendations,
    freshnessReport,
    divergenceReport,
  };
}

// ── Batch scoring ──────────────────────────────────────────────────────────────

export async function batchTrustScore(
  npis: string[],
): Promise<Array<{ npi: string; score: number; band: TrustBand; computedAt: string }>> {
  const results = await Promise.allSettled(npis.map(npi => computeTrustScoreV1(npi)));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') {
      return {
        npi:         r.value.npi,
        score:       r.value.score,
        band:        r.value.band,
        computedAt:  r.value.computedAt,
      };
    }
    log('error', `[TrustScoreV1] batch failed for NPI ${npis[i]}: ${(r.reason as Error)?.message}`);
    return { npi: npis[i]!, score: 0, band: 'L0' as TrustBand, computedAt: new Date().toISOString() };
  });
}
