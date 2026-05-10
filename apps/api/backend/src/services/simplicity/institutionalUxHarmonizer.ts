/**
 * institutionalUxHarmonizer.ts — Institutional UX Harmonization
 *
 * Normalises the terminology used across employer, verifier, and issuer
 * surfaces so that the same underlying concept always renders with the
 * same label regardless of which surface originates the render.
 *
 * Invariants:
 *   - Ambiguous concepts are never merged into a single label.
 *     They stay distinct — the harmonizer maps each to a UNIQUE label.
 *   - Banned strings from the truth contract are blocked at this layer.
 *   - The original raw term is always preserved in HarmonizedTerm.rawTerm
 *     so the mapping is fully reversible.
 */

// ── Truth-contract ban list (mirrors CLAUDE.md) ───────────────────────────────

const BANNED_TERMS: readonly string[] = [
  'automatically verified',
  'guaranteed verification',
  'complete credentialing',
  'instant credentialing',
  'legally accepted',
  'risk transferred',
  'final verification without review',
  'source confirmed before response',
  'certified compliant',
  'HIPAA compliant',
  'SOC2 certified',
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type InstitutionalSurface = 'employer' | 'verifier' | 'issuer' | 'clinician';

export interface HarmonizedTerm {
  rawTerm: string;
  harmonizedLabel: string;
  surface: InstitutionalSurface;
  /** true when the raw term required translation (false = already canonical) */
  normalized: boolean;
  /** true when the raw term was ambiguous and the mapping required a qualifier */
  qualifierAdded: boolean;
}

export type HarmonizationResult =
  | { ok: true; terms: HarmonizedTerm[] }
  | { ok: false; reason: string; bannedTerms: string[] };

// ── Canonical label registry ───────────────────────────────────────────────────
// Keys are lowercase raw terms; values are surface-specific canonical labels.
// When a surface is not listed, the 'default' entry applies.

type CanonicalMap = Record<string, Partial<Record<InstitutionalSurface | 'default', string>>>;

const CANONICAL_LABEL_REGISTRY: CanonicalMap = {
  verified: {
    employer: 'Source-backed',
    verifier: 'Source-verified',
    issuer: 'Issuer-confirmed',
    clinician: 'On file',
    default: 'Source-backed',
  },
  'verification pending': {
    default: 'Awaiting source check',
  },
  'not verified': {
    employer: 'Source not yet confirmed',
    verifier: 'Source unconfirmed',
    issuer: 'Not yet submitted',
    clinician: 'Needs attention',
    default: 'Source not yet confirmed',
  },
  accepted: {
    employer: 'Accepted for head-start',
    default: 'Accepted',
  },
  'in review': {
    employer: 'Routed for manual review',
    verifier: 'Under review',
    default: 'In manual review',
  },
  expired: {
    default: 'Expired — renewal required',
  },
  'trust score': {
    employer: 'Credential readiness score',
    verifier: 'Credential readiness score',
    default: 'Readiness score',
  },
  'psv': {
    default: 'Primary-source verification',
  },
  'psv receipt': {
    default: 'Primary-source verification receipt',
  },
  'ready for review': {
    employer: 'Ready for employer review',
    verifier: 'Ready for verifier confirmation',
    default: 'Ready for review',
  },
};

// ── Core harmonization logic ───────────────────────────────────────────────────

function detectBannedTerms(terms: string[]): string[] {
  const lower = terms.map(t => t.toLowerCase());
  return BANNED_TERMS.filter(banned => lower.some(t => t.includes(banned.toLowerCase())));
}

function resolveLabel(rawTerm: string, surface: InstitutionalSurface): { label: string; normalized: boolean; qualifierAdded: boolean } {
  const key = rawTerm.toLowerCase().trim();
  const entry = CANONICAL_LABEL_REGISTRY[key];

  if (!entry) {
    return { label: rawTerm, normalized: false, qualifierAdded: false };
  }

  const label = entry[surface] ?? entry['default'] ?? rawTerm;
  const normalized = label !== rawTerm;
  // Qualifier added when the resolved label is longer than the raw term
  // (indicates disambiguation text was appended)
  const qualifierAdded = label.length > rawTerm.length && normalized;

  return { label, normalized, qualifierAdded };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Harmonize a list of raw UX terms for a given institutional surface.
 *
 * Returns HarmonizationResult.ok=false if any term matches the truth-contract
 * ban list — callers must treat this as a hard stop before rendering.
 */
export function harmonizeTerms(
  rawTerms: string[],
  surface: InstitutionalSurface,
): HarmonizationResult {
  const banned = detectBannedTerms(rawTerms);
  if (banned.length > 0) {
    return { ok: false, reason: 'Banned truth-contract term detected', bannedTerms: banned };
  }

  const terms: HarmonizedTerm[] = rawTerms.map(rawTerm => {
    const { label, normalized, qualifierAdded } = resolveLabel(rawTerm, surface);
    return {
      rawTerm,
      harmonizedLabel: label,
      surface,
      normalized,
      qualifierAdded,
    };
  });

  return { ok: true, terms };
}

/**
 * Harmonize a single term — convenience wrapper.
 */
export function harmonizeTerm(
  rawTerm: string,
  surface: InstitutionalSurface,
): HarmonizedTerm | null {
  const result = harmonizeTerms([rawTerm], surface);
  if (!result.ok) return null;
  return result.terms[0] ?? null;
}

/**
 * Measure the proportion of a term set that required harmonization.
 * Returns 0–1: 1 = all terms were already canonical; 0 = all required mapping.
 */
export function measureHarmonizationCoverage(
  rawTerms: string[],
  surface: InstitutionalSurface,
): number {
  if (rawTerms.length === 0) return 1;
  const result = harmonizeTerms(rawTerms, surface);
  if (!result.ok) return 0;
  const alreadyCanonical = result.terms.filter(t => !t.normalized).length;
  return alreadyCanonical / rawTerms.length;
}
