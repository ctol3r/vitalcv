/**
 * OpenEvidence Attrition Risk Engine — WAVE C69.
 *
 * Pure functional risk evaluator. Takes a clinical taxonomy code +
 * geographic context (zip or explicit rural flag) and emits an
 * attrition-risk multiplier + a credentialing-failure replacement-cost
 * band sourced from the published OpenEvidence physician-attrition
 * benchmark range.
 *
 * Conservative midpoints. Returns NULL for unknown taxonomies; callers
 * MUST surface "specialty unavailable" rather than fabricate a default.
 *
 * No hidden assumptions about urban-vs-rural — the caller passes
 * explicit `isRural` whenever known. The ZIP-prefix heuristic is a
 * coarse fallback only and is documented as such on the result rationale.
 */

// ── Specialty risk profile ───────────────────────────────────────────────

export interface SpecialtyRiskProfile {
  /** Plain-English specialty label. */
  readonly specialty: string;
  /**
   * Whether the specialty is procedural (surgery, orthopedics, etc.) —
   * procedural specialties carry higher base replacement cost.
   */
  readonly procedural: boolean;
  /**
   * Baseline multiplier for attrition risk before geographic adjustment.
   * Range 1.0–2.0; conservative midpoints from OpenEvidence benchmark
   * literature for early-tenure clinician attrition.
   */
  readonly baseRiskMultiplier: number;
  /**
   * Replacement-cost band (USD) for a single clinician departure within
   * the first 24 months — recruiter fees, sign-on, locum coverage,
   * onboarding overhead, lost-revenue ramp.
   */
  readonly replacementCostUsd: {
    readonly low: number;
    readonly high: number;
  };
}

export const SPECIALTY_RISK_PROFILES: Record<string, SpecialtyRiskProfile> = {
  '207R00000X': {
    specialty: 'Internal Medicine',
    procedural: false,
    baseRiskMultiplier: 1.1,
    replacementCostUsd: { low: 300_000, high: 600_000 },
  },
  '207Q00000X': {
    specialty: 'Family Medicine',
    procedural: false,
    baseRiskMultiplier: 1.15,
    replacementCostUsd: { low: 250_000, high: 500_000 },
  },
  '208600000X': {
    specialty: 'Surgery',
    procedural: true,
    baseRiskMultiplier: 1.4,
    replacementCostUsd: { low: 750_000, high: 1_500_000 },
  },
  '207X00000X': {
    specialty: 'Orthopedic Surgery',
    procedural: true,
    baseRiskMultiplier: 1.5,
    replacementCostUsd: { low: 800_000, high: 1_800_000 },
  },
  '2084P0800X': {
    specialty: 'Psychiatry',
    procedural: false,
    baseRiskMultiplier: 1.25,
    replacementCostUsd: { low: 350_000, high: 700_000 },
  },
  '207RH0000X': {
    specialty: 'Hospital Medicine',
    procedural: false,
    baseRiskMultiplier: 1.2,
    replacementCostUsd: { low: 400_000, high: 800_000 },
  },
  '207P00000X': {
    specialty: 'Emergency Medicine',
    procedural: false,
    baseRiskMultiplier: 1.3,
    replacementCostUsd: { low: 450_000, high: 900_000 },
  },
} as const;

// ── Geographic context ───────────────────────────────────────────────────

/**
 * HRSA-defined rural ZIP prefixes are large and updated frequently. For
 * the demo we use a small, conservative heuristic list — sparsely-
 * populated state ZIP prefixes that overlap HRSA rural classifications.
 *
 * Production callers should pass `isRural` directly from an authoritative
 * source (HRSA RUCA tables, USDA ERS rural-urban commuting area codes).
 */
const RURAL_ZIP_PREFIXES: ReadonlySet<string> = new Set([
  '57', // South Dakota
  '58', // North Dakota
  '59', // Montana
  '82', // Wyoming
  '83', // Idaho
  '99', // Alaska (much of)
  '04', // Maine (much of)
  '05', // Vermont
  '66', // Kansas (rural west)
  '67', // Kansas (rural)
  '68', // Nebraska
  '69', // Nebraska (rural)
  '79', // Texas (West)
  '88', // New Mexico
]);

const RURAL_RISK_MULTIPLIER = 1.6;
const RURAL_COST_MULTIPLIER = 1.35;

export function isRuralZipHeuristic(zipCode: string | null | undefined): boolean {
  if (!zipCode || zipCode.length < 2) return false;
  return RURAL_ZIP_PREFIXES.has(zipCode.slice(0, 2));
}

// ── Risk evaluation ──────────────────────────────────────────────────────

export type RiskBand = 'low' | 'moderate' | 'high' | 'severe';

export interface MarketRiskResult {
  taxonomyCode: string;
  specialty: string;
  procedural: boolean;
  geography: 'urban' | 'rural';
  /**
   * Combined attrition-risk multiplier; product of the specialty base
   * and the geographic modifier. 1.0 represents a baseline urban
   * internal-medicine cohort.
   */
  attritionRiskMultiplier: number;
  riskBand: RiskBand;
  replacementCost: {
    /** Conservative low end of the cost band, USD. */
    low: number;
    /** Conservative high end, USD. */
    high: number;
    /** Midpoint USD — the figure to display on quiet UI surfaces. */
    midpoint: number;
  };
  rationale: string;
  source: string;
}

export interface EvaluateMarketRiskInput {
  taxonomyCode: string;
  /**
   * Explicit rural flag — preferred input. When omitted, falls back to
   * the ZIP-prefix heuristic and notes the imprecision in `rationale`.
   */
  isRural?: boolean;
  /** 5-digit ZIP code (US). Used only when `isRural` is undefined. */
  zipCode?: string | null;
}

const SOURCE_CITATION =
  'OpenEvidence physician-attrition benchmark · early-tenure cost-band midpoint';

export function evaluateMarketRisk(
  input: EvaluateMarketRiskInput,
): MarketRiskResult | null {
  const profile = SPECIALTY_RISK_PROFILES[input.taxonomyCode];
  if (!profile) return null;

  const ruralExplicit = typeof input.isRural === 'boolean';
  const rural = ruralExplicit
    ? Boolean(input.isRural)
    : isRuralZipHeuristic(input.zipCode);

  const riskMultiplier =
    profile.baseRiskMultiplier * (rural ? RURAL_RISK_MULTIPLIER : 1);
  const costMultiplier = rural ? RURAL_COST_MULTIPLIER : 1;
  const low = Math.round(profile.replacementCostUsd.low * costMultiplier);
  const high = Math.round(profile.replacementCostUsd.high * costMultiplier);
  const midpoint = Math.round((low + high) / 2);

  const rationaleParts: string[] = [
    `${profile.specialty} (${profile.procedural ? 'procedural' : 'non-procedural'})`,
  ];
  if (rural) {
    rationaleParts.push(
      ruralExplicit ? 'rural service area (operator-flagged)' : 'rural ZIP-prefix heuristic',
    );
  } else {
    rationaleParts.push(
      ruralExplicit ? 'urban service area (operator-flagged)' : 'urban (ZIP-prefix default)',
    );
  }

  return {
    taxonomyCode: input.taxonomyCode,
    specialty: profile.specialty,
    procedural: profile.procedural,
    geography: rural ? 'rural' : 'urban',
    attritionRiskMultiplier: round2(riskMultiplier),
    riskBand: bandFor(riskMultiplier),
    replacementCost: { low, high, midpoint },
    rationale: rationaleParts.join(' · '),
    source: SOURCE_CITATION,
  };
}

function bandFor(multiplier: number): RiskBand {
  if (multiplier < 1.25) return 'low';
  if (multiplier < 1.75) return 'moderate';
  if (multiplier < 2.25) return 'high';
  return 'severe';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isKnownTaxonomyForRisk(taxonomyCode: string): boolean {
  return taxonomyCode in SPECIALTY_RISK_PROFILES;
}

export function listSupportedTaxonomiesForRisk(): readonly string[] {
  return Object.keys(SPECIALTY_RISK_PROFILES);
}
