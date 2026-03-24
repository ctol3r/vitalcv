/**
 * specialtyNormalization.ts — Wave G8: Specialty Normalization + Aggregate Context
 *
 * Bridges specialty representations across:
 *   - NPPES taxonomy code (primary source)
 *   - CMS specialty code (from PECOS/D&C)
 *   - Training specialty (residency/fellowship)
 *   - Market context buckets (for workforce pressure overlays)
 *
 * IMPORTANT: This file provides AGGREGATE context only.
 *   - Never links aggregate NRMP/AAMC data to individual clinicians
 *   - Specialty normalization updates the profile display — it does NOT
 *     change licensure, board certification, or readiness state
 *   - Workforce pressure indicators are contextual labels, not decisions
 */

// ── NPPES taxonomy → canonical specialty bucket ────────────────────────────────

export type CanonicalSpecialtyBucket =
  | 'internal_medicine'
  | 'family_medicine'
  | 'hospitalist'
  | 'emergency_medicine'
  | 'surgery_general'
  | 'surgery_orthopedic'
  | 'surgery_cardiovascular'
  | 'anesthesiology'
  | 'radiology'
  | 'psychiatry'
  | 'pediatrics'
  | 'obstetrics_gynecology'
  | 'neurology'
  | 'oncology'
  | 'nursing_np_pa'
  | 'nursing_rn'
  | 'nursing_crna'
  | 'pharmacy'
  | 'physical_therapy'
  | 'other_physician'
  | 'other_allied_health'
  | 'unknown';

/**
 * Map NPPES taxonomy codes to canonical specialty buckets.
 * This is not exhaustive — expands as needed.
 * Source: https://taxonomy.nucc.org/
 */
const NPPES_TAXONOMY_TO_BUCKET: Record<string, CanonicalSpecialtyBucket> = {
  '207R00000X': 'internal_medicine',       // Internal Medicine
  '207RI0200X': 'internal_medicine',       // Internal Medicine: Infectious Disease
  '207RC0000X': 'internal_medicine',       // Internal Medicine: Cardiovascular Disease
  '207RG0100X': 'internal_medicine',       // Internal Medicine: Gastroenterology
  '207RE0101X': 'internal_medicine',       // Internal Medicine: Endocrinology
  '207RN0300X': 'internal_medicine',       // Internal Medicine: Nephrology
  '207RP1001X': 'internal_medicine',       // Internal Medicine: Pulmonary Disease
  '207Q00000X': 'family_medicine',         // Family Medicine
  '208D00000X': 'hospitalist',             // General Practice (hospitalist proxy)
  '207P00000X': 'emergency_medicine',      // Emergency Medicine
  '208600000X': 'surgery_general',         // Surgery
  '207X00000X': 'surgery_orthopedic',      // Orthopedic Surgery
  '208G00000X': 'surgery_cardiovascular',  // Thoracic Surgery
  '207U00000X': 'surgery_cardiovascular',  // Cardiac Surgery — no standard code, mapped
  '207L00000X': 'anesthesiology',          // Anesthesiology
  '2084N0400X': 'psychiatry',              // Psychiatry
  '208000000X': 'pediatrics',              // Pediatrics
  '207V00000X': 'obstetrics_gynecology',   // Obstetrics & Gynecology
  '204D00000X': 'neurology',              // Neuromusculoskeletal Medicine
  '2084P0800X': 'psychiatry',              // Psychiatry: Addiction
  '207Y00000X': 'radiology',              // Radiology (not standard code)
  '2085R0001X': 'radiology',              // Radiology: Diagnostic
  '207ZH0000X': 'radiology',              // Radiology: Therapeutic
  '207ZP0101X': 'radiology',              // Radiology: Interventional
  '207RH0000X': 'oncology',               // Internal Medicine: Hematology/Oncology
  '207RX0202X': 'oncology',               // Internal Medicine: Medical Oncology
  // Nursing
  '363L00000X': 'nursing_np_pa',           // Nurse Practitioner
  '363A00000X': 'nursing_np_pa',           // Physician Assistant
  '363LF0000X': 'nursing_np_pa',           // NP: Family
  '363LP0200X': 'nursing_np_pa',           // NP: Pediatrics
  '363LS0200X': 'nursing_np_pa',           // NP: School
  '363LP2300X': 'nursing_np_pa',           // NP: Primary Care
  '364SA2200X': 'nursing_crna',            // CRNA
  '374700000X': 'nursing_rn',              // Registry / Agency RN
  // Allied health
  '226300000X': 'physical_therapy',
  '183500000X': 'pharmacy',
};

export function mapTaxonomyToSpecialtyBucket(taxonomyCode: string): CanonicalSpecialtyBucket {
  return NPPES_TAXONOMY_TO_BUCKET[taxonomyCode] ?? 'unknown';
}

export function mapTaxonomyArrayToSpecialtyBucket(codes: string[]): CanonicalSpecialtyBucket {
  for (const code of codes) {
    const bucket = mapTaxonomyToSpecialtyBucket(code);
    if (bucket !== 'unknown') return bucket;
  }
  return 'unknown';
}

// ── Market context overlays ────────────────────────────────────────────────────

export interface SpecialtyMarketContext {
  specialtyBucket: CanonicalSpecialtyBucket;
  /** Whether this specialty is on CMS/BLS high-demand list */
  highDemand: boolean;
  /** Directional shortage signal — not individual-level data */
  supplyPressure: 'high_shortage' | 'moderate_shortage' | 'balanced' | 'surplus' | 'unknown';
  /** Source of supply pressure signal */
  supplyPressureSource: 'aamc_workforce_2024' | 'hrsa_projections_2035' | 'bls_ooh_2024' | 'heuristic';
  /** Human-readable context for employer packet (aggregate only) */
  marketContextLabel: string;
  /** Always false — aggregate market data is never decision-grade */
  readonly decisionGrade: false;
}

/**
 * Aggregate supply pressure estimates by specialty bucket.
 * Sources: AAMC 2024 workforce report, HRSA 2035 projections, BLS OOH 2024.
 * These are AGGREGATE national estimates — not individual assessments.
 * Updated manually as workforce reports are published.
 * Last updated: 2026-03.
 */
const SPECIALTY_MARKET_CONTEXT: Record<CanonicalSpecialtyBucket, Omit<SpecialtyMarketContext, 'specialtyBucket' | 'decisionGrade'>> = {
  internal_medicine:      { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Internal medicine: national moderate shortage projected through 2034 (AAMC 2024)' },
  family_medicine:        { highDemand: true,  supplyPressure: 'high_shortage',     supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Family medicine: significant national shortage, especially in rural/underserved areas (AAMC 2024)' },
  hospitalist:            { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'heuristic',           marketContextLabel: 'Hospital medicine: high demand driven by inpatient volume growth; locum market expanding' },
  emergency_medicine:     { highDemand: true,  supplyPressure: 'balanced',          supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Emergency medicine: supply has grown; regional imbalances persist in rural areas (AAMC 2024)' },
  surgery_general:        { highDemand: false, supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'General surgery: ongoing shortage, particularly in community/rural hospitals (AAMC 2024)' },
  surgery_orthopedic:     { highDemand: false, supplyPressure: 'balanced',          supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Orthopedic surgery: generally balanced nationally; high demand in musculoskeletal care expansion' },
  surgery_cardiovascular: { highDemand: false, supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Cardiovascular surgery: subspecialty demand growing with aging population (AAMC 2024)' },
  anesthesiology:         { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Anesthesiology: workforce gap widening as CRNAs expand scope; locum demand high (AAMC 2024)' },
  radiology:              { highDemand: false, supplyPressure: 'balanced',          supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Radiology: AI-assisted reading volumes growing; teleradiology market expanding (AAMC 2024)' },
  psychiatry:             { highDemand: true,  supplyPressure: 'high_shortage',     supplyPressureSource: 'hrsa_projections_2035', marketContextLabel: 'Psychiatry: severe national shortage projected to worsen through 2035; highest demand in rural/low-income areas (HRSA 2035)' },
  pediatrics:             { highDemand: false, supplyPressure: 'balanced',          supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Pediatrics: generally balanced but subspecialty gaps exist in rural areas (AAMC 2024)' },
  obstetrics_gynecology:  { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'OB/GYN: national shortage, particularly in rural maternity deserts (AAMC 2024)' },
  neurology:              { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Neurology: growing demand driven by aging population; shortage expected through 2034 (AAMC 2024)' },
  oncology:               { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'aamc_workforce_2024', marketContextLabel: 'Oncology: demand outpacing supply growth as cancer prevalence increases (AAMC 2024)' },
  nursing_np_pa:          { highDemand: true,  supplyPressure: 'balanced',          supplyPressureSource: 'bls_ooh_2024',        marketContextLabel: 'Nurse Practitioners / PAs: rapid growth; scope of practice expanding nationally (BLS OOH 2024)' },
  nursing_rn:             { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'hrsa_projections_2035', marketContextLabel: 'Registered Nursing: post-COVID pipeline challenges; national shortage projected through 2030 (HRSA 2035)' },
  nursing_crna:           { highDemand: true,  supplyPressure: 'moderate_shortage', supplyPressureSource: 'bls_ooh_2024',        marketContextLabel: 'CRNAs: high demand as anesthesia delivery models evolve; above-average salary growth (BLS OOH 2024)' },
  pharmacy:               { highDemand: false, supplyPressure: 'balanced',          supplyPressureSource: 'bls_ooh_2024',        marketContextLabel: 'Pharmacy: supply generally stable; clinical pharmacy roles growing (BLS OOH 2024)' },
  physical_therapy:       { highDemand: false, supplyPressure: 'balanced',          supplyPressureSource: 'bls_ooh_2024',        marketContextLabel: 'Physical Therapy: steady growth; outpatient and home health demand increasing (BLS OOH 2024)' },
  other_physician:        { highDemand: false, supplyPressure: 'unknown',           supplyPressureSource: 'heuristic',           marketContextLabel: 'Specialty market context not available for this specialty bucket' },
  other_allied_health:    { highDemand: false, supplyPressure: 'unknown',           supplyPressureSource: 'heuristic',           marketContextLabel: 'Specialty market context not available for this specialty bucket' },
  unknown:                { highDemand: false, supplyPressure: 'unknown',           supplyPressureSource: 'heuristic',           marketContextLabel: 'Specialty not identified — market context unavailable' },
};

export function getSpecialtyMarketContext(bucket: CanonicalSpecialtyBucket): SpecialtyMarketContext {
  const ctx = SPECIALTY_MARKET_CONTEXT[bucket];
  return { ...ctx, specialtyBucket: bucket, decisionGrade: false };
}

export function getMarketContextFromTaxonomy(taxonomyCode: string): SpecialtyMarketContext {
  const bucket = mapTaxonomyToSpecialtyBucket(taxonomyCode);
  return getSpecialtyMarketContext(bucket);
}

// ── Specialty label helpers ────────────────────────────────────────────────────

const BUCKET_LABELS: Record<CanonicalSpecialtyBucket, string> = {
  internal_medicine: 'Internal Medicine',
  family_medicine: 'Family Medicine',
  hospitalist: 'Hospital Medicine',
  emergency_medicine: 'Emergency Medicine',
  surgery_general: 'General Surgery',
  surgery_orthopedic: 'Orthopedic Surgery',
  surgery_cardiovascular: 'Cardiovascular Surgery',
  anesthesiology: 'Anesthesiology',
  radiology: 'Radiology',
  psychiatry: 'Psychiatry',
  pediatrics: 'Pediatrics',
  obstetrics_gynecology: 'Obstetrics & Gynecology',
  neurology: 'Neurology',
  oncology: 'Oncology / Hematology',
  nursing_np_pa: 'Nurse Practitioner / Physician Assistant',
  nursing_rn: 'Registered Nursing',
  nursing_crna: 'Certified Registered Nurse Anesthetist',
  pharmacy: 'Pharmacy',
  physical_therapy: 'Physical Therapy',
  other_physician: 'Other Physician Specialty',
  other_allied_health: 'Other Allied Health',
  unknown: 'Unknown Specialty',
};

export function specialtyBucketLabel(bucket: CanonicalSpecialtyBucket): string {
  return BUCKET_LABELS[bucket] ?? 'Unknown';
}
