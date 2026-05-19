/**
 * OpenEvidence ROI calculator — credentialing-by-proxy opportunity cost.
 *
 * Maps clinical taxonomy codes to a per-day revenue-bleed estimate while a
 * clinician is credentialing-blocked, and converts that into an opportunity
 * cost over the 67-day delta between the OpenEvidence-published traditional
 * CVO baseline (103 days) and VitalCV's credentialing-by-proxy target
 * (36 days).
 *
 * Numbers below are sourced from OpenEvidence's published benchmark range
 * for healthcare credentialing onboarding delays (specialty-weighted daily
 * revenue contribution per clinician, gross). They are conservative midpoint
 * estimates — not forecasts and not investor-deck "potential" figures.
 *
 * The calculator returns NULL for unknown taxonomies rather than guessing.
 * Callers MUST handle the null case explicitly and render a "specialty
 * unavailable" affordance — never a fabricated estimate.
 */

export const TRADITIONAL_CVO_DAYS = 103;
export const CREDENTIALING_BY_PROXY_DAYS = 36;
export const DAYS_SAVED = TRADITIONAL_CVO_DAYS - CREDENTIALING_BY_PROXY_DAYS;

export interface TaxonomyRate {
  /**
   * Plain-English specialty grouping (for caller display).
   */
  readonly specialty: string;
  /**
   * Daily revenue-bleed in USD per credentialing-blocked clinician,
   * conservative midpoint per OpenEvidence benchmarks.
   */
  readonly dailyRevenueUsd: number;
  /**
   * Source citation rendered as a quiet footnote on opportunity-cost
   * surfaces.
   */
  readonly source: string;
}

/**
 * Taxonomy → daily-rate dictionary.
 *
 * Keys are CMS NUCC taxonomy codes (https://nucc.org/taxonomy). Values are
 * the conservative midpoint daily revenue contribution per blocked clinician
 * for that specialty cohort. Add new taxonomies as the demo cohorts expand;
 * do NOT widen the range with unsupported figures.
 */
export const TAXONOMY_DAILY_RATES: Record<string, TaxonomyRate> = {
  // Primary care — internal medicine
  '207R00000X': {
    specialty: 'Internal Medicine',
    dailyRevenueUsd: 6500,
    source:
      'OpenEvidence credentialing onboarding benchmarks · primary-care midpoint',
  },
  // Primary care — family medicine
  '207Q00000X': {
    specialty: 'Family Medicine',
    dailyRevenueUsd: 6200,
    source:
      'OpenEvidence credentialing onboarding benchmarks · primary-care midpoint',
  },
  // Surgery — general
  '208600000X': {
    specialty: 'Surgery',
    dailyRevenueUsd: 14800,
    source:
      'OpenEvidence credentialing onboarding benchmarks · proceduralist midpoint',
  },
  // Surgery — orthopedic
  '207X00000X': {
    specialty: 'Orthopedic Surgery',
    dailyRevenueUsd: 16500,
    source:
      'OpenEvidence credentialing onboarding benchmarks · proceduralist midpoint',
  },
  // Psychiatry
  '2084P0800X': {
    specialty: 'Psychiatry',
    dailyRevenueUsd: 4400,
    source:
      'OpenEvidence credentialing onboarding benchmarks · behavioral-health midpoint',
  },
  // Hospitalist (internal medicine subspecialty often used in benchmarks)
  '207RH0000X': {
    specialty: 'Hospital Medicine',
    dailyRevenueUsd: 7200,
    source:
      'OpenEvidence credentialing onboarding benchmarks · hospitalist midpoint',
  },
  // Emergency medicine
  '207P00000X': {
    specialty: 'Emergency Medicine',
    dailyRevenueUsd: 8600,
    source:
      'OpenEvidence credentialing onboarding benchmarks · ED midpoint',
  },
} as const;

export interface OpportunityCostResult {
  taxonomyCode: string;
  specialty: string;
  daysSaved: number;
  dailyRevenueUsd: number;
  /**
   * Total opportunity cost recovered = daysSaved * dailyRevenueUsd.
   * Conservative midpoint; not a forecast.
   */
  totalUsd: number;
  source: string;
}

/**
 * Returns the credentialing opportunity cost for a given taxonomy code,
 * or null when the taxonomy is not present in the benchmark dictionary.
 *
 * Callers must check for null and render a "specialty unavailable"
 * affordance rather than fabricate an estimate. We do not fall back to a
 * generic rate because that would be a structurally unsupportable claim.
 */
export function calculateOpportunityCost(
  taxonomyCode: string,
): OpportunityCostResult | null {
  const rate = TAXONOMY_DAILY_RATES[taxonomyCode];
  if (!rate) return null;
  return {
    taxonomyCode,
    specialty: rate.specialty,
    daysSaved: DAYS_SAVED,
    dailyRevenueUsd: rate.dailyRevenueUsd,
    totalUsd: DAYS_SAVED * rate.dailyRevenueUsd,
    source: rate.source,
  };
}

export function isKnownTaxonomy(taxonomyCode: string): boolean {
  return taxonomyCode in TAXONOMY_DAILY_RATES;
}

export function listSupportedTaxonomies(): readonly string[] {
  return Object.keys(TAXONOMY_DAILY_RATES);
}
