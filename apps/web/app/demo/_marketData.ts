/**
 * _marketData.ts — OpenEvidence-backed market signals for the
 * /launch + /demo surfaces.
 *
 * IMPORTANT — truth contract:
 *   - Every value here is an ILLUSTRATIVE MARKET BENCHMARK from
 *     published research and is not a measured VitalCV outcome.
 *   - Consumers must render these as "research signal" or
 *     "illustrative market benchmark", not as VitalCV-owned results.
 *   - Citation labels are included so the rendered UI can disclose
 *     the benchmark origin.
 */

// ── Credentialing cycle ────────────────────────────────────────────────────

export const TRADITIONAL_CREDENTIALING_DAYS = 103;
export const CBP_CREDENTIALING_DAYS = 36;
export const DAYS_SAVED = TRADITIONAL_CREDENTIALING_DAYS - CBP_CREDENTIALING_DAYS;

export const DAILY_DELAY_COST_LOW = 2700;
export const DAILY_DELAY_COST_HIGH = 5400;

export const SINGLE_PHYSICIAN_DELAY_COST_LOW = DAYS_SAVED * DAILY_DELAY_COST_LOW;
export const SINGLE_PHYSICIAN_DELAY_COST_HIGH = DAYS_SAVED * DAILY_DELAY_COST_HIGH;

// ── Workforce / equity research signals ────────────────────────────────────

export interface ResearchSignal {
  /** Short label used as the column / row heading. */
  label: string;
  /** Display value (string so percentage / range formatting is explicit). */
  value: string;
  /** One-sentence context for the value. */
  context: string;
  /** Citation hint — research origin, not a hyperlink. */
  cite: string;
}

export const RESEARCH_SIGNALS = {
  femalePhysicianAttritionHazard: {
    label: 'Female physician attrition hazard',
    value: '+43% higher',
    context: 'Female physicians exit clinical practice at a 43% higher hazard than male counterparts in cited workforce research.',
    cite: 'Published workforce attrition research; sized at hazard-ratio level.',
  },
  femaleMedianExitAge: {
    label: 'Female vs male median exit age',
    value: '49 vs 64',
    context: 'Median age at exit from clinical practice for female vs male physicians.',
    cite: 'Same workforce-attrition research; median across studied cohorts.',
  },
  blackSurgicalResidentAttrition: {
    label: 'Black surgical resident attrition',
    value: '10.6% total · 5.2% unintended',
    context: 'Black/African American surgical residents recorded the highest attrition in the cited surgical-resident attrition study.',
    cite: 'Surgical resident attrition study.',
  },
  ruralInternationalBornPhysicianShare: {
    label: 'Rural physicians born internationally',
    value: '28.0%',
    context: 'Share of rural physicians born outside the United States; rural workforce depends materially on international medical graduates.',
    cite: 'Rural physician workforce composition research.',
  },
  psychiatryAdminBurden: {
    label: 'Psychiatry administrative burden',
    value: '20.3% of working time',
    context: 'Share of working time psychiatrists spend on administration in cited time-use research.',
    cite: 'Time-use survey of practicing physicians.',
  },
  primaryCareExitRate: {
    label: 'Primary care annual exit rate',
    value: '4.41%',
    context: 'Annual rate at which primary care physicians exit the active workforce.',
    cite: 'Primary care workforce exit research.',
  },
  ruralPhysicianShortageProjection: {
    label: 'Nonmetropolitan shortage projection (2036)',
    value: '~56% shortage',
    context: 'Projected nonmetropolitan physician workforce shortfall by 2036.',
    cite: 'HHS / HRSA workforce projection.',
  },
  nonmetroPsychiatryAdequacy: {
    label: 'Nonmetro psychiatry adequacy',
    value: '34.8%',
    context: 'Projected workforce adequacy for psychiatry in nonmetropolitan areas (2037).',
    cite: 'HHS / HRSA workforce projection.',
  },
  nonmetroInternalMedicineAdequacy: {
    label: 'Nonmetro internal medicine adequacy (2037)',
    value: '41.8%',
    context: 'Projected workforce adequacy for internal medicine in nonmetropolitan areas (2037).',
    cite: 'HHS / HRSA workforce projection.',
  },
} as const satisfies Record<string, ResearchSignal>;

// ── Specialty / persona options (used by the RoiCalculator + employer demo) ──
//
// Persona-style mix of specialty (Primary Care, Psychiatry) and
// role/setting framings (Rural / FQHC, Locum Tenens Hospitalist,
// Multi-State Nurse Practitioner) because the employer-side pitch
// shifts on setting + cross-state authority, not on specialty alone.

export type Specialty =
  | 'rural_fqhc'
  | 'locum_tenens_hospitalist'
  | 'img_rural_primary_care'
  | 'multi_state_np'
  | 'psychiatry'
  | 'primary_care'
  | 'cardiothoracic_surgery'
  | 'orthopedic_surgery'
  | 'emergency_medicine'
  | 'obgyn';

export const SPECIALTY_LABEL: Record<Specialty, string> = {
  rural_fqhc: 'Rural / FQHC',
  locum_tenens_hospitalist: 'Locum Tenens Hospitalist',
  img_rural_primary_care: 'IMG / Rural Primary Care',
  multi_state_np: 'Multi-State Nurse Practitioner',
  psychiatry: 'Psychiatry',
  primary_care: 'Primary Care',
  cardiothoracic_surgery: 'Cardiothoracic Surgery',
  orthopedic_surgery: 'Orthopedic Surgery',
  emergency_medicine: 'Emergency Medicine',
  obgyn: 'OB/GYN',
};

export const SPECIALTY_OPTIONS: ReadonlyArray<Specialty> = [
  'rural_fqhc',
  'locum_tenens_hospitalist',
  'img_rural_primary_care',
  'multi_state_np',
  'psychiatry',
  'primary_care',
  'cardiothoracic_surgery',
  'orthopedic_surgery',
  'emergency_medicine',
  'obgyn',
];

// ── Required disclaimers / labels (centralized) ────────────────────────────

export const MARKET_BENCHMARK_LABELS = {
  illustrative: 'Illustrative market benchmark',
  notGuaranteed: 'Not a guaranteed VitalCV outcome',
  methodology: 'Based on published credentialing-by-proxy and physician vacancy/revenue assumptions.',
  researchSignal: 'Research signal',
} as const;

// ── Pure ROI math helpers (tested in __tests__/marketData.test.ts) ─────────

export function computeRoiRange(args: {
  providerCount: number;
  daysSaved?: number;
  dailyLow?: number;
  dailyHigh?: number;
}): { totalLow: number; totalHigh: number } {
  const d = args.daysSaved ?? DAYS_SAVED;
  const lo = args.dailyLow ?? DAILY_DELAY_COST_LOW;
  const hi = args.dailyHigh ?? DAILY_DELAY_COST_HIGH;
  const totalLow = args.providerCount * d * lo;
  const totalHigh = args.providerCount * d * hi;
  return { totalLow, totalHigh };
}

export function formatUsdCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}
