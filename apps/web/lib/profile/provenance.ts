/**
 * Provenance vocabulary for the clinician profile + inbox surfaces.
 *
 * Single export module so both the GOD-2 ClinicianProfileSections
 * surface and the GOD-3 Knowledge Inbox classifier share one
 * vocabulary. Two names are exposed for back-compat:
 *   - `ProfileProvenance` (used by ClinicianProfileSections + helpers)
 *   - `FieldProvenance`   (used by lib/knowledge-inbox/types)
 * Both are the same union, so consumers can use either name.
 *
 * Rule: every user-visible field carries exactly one provenance tag.
 * There is no "implied" truthiness — missing data is UNKNOWN,
 * user-typed data is USER_ENTERED, source-backed data is VERIFIED,
 * and contradictions are CONFLICT.
 */

export type ProfileProvenance =
  | 'VERIFIED'
  | 'USER_ENTERED'
  | 'INFERRED'
  | 'UNKNOWN'
  | 'CONFLICT';

/**
 * Alias kept for the Knowledge Inbox types module. Both names refer
 * to the same vocabulary; either is safe to import.
 */
export type FieldProvenance = ProfileProvenance;

export interface ProvenanceMeta {
  label: string;
  description: string;
  /** Tailwind classes for the badge chip. Keep contrast high on mobile. */
  badgeClass: string;
}

export const PROVENANCE_META: Record<ProfileProvenance, ProvenanceMeta> = {
  VERIFIED: {
    label: 'Verified',
    description:
      'Backed by a source-of-record check (e.g., NPPES identity, OIG LEIE federal exclusion, PECOS public enrollment).',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600',
  },
  USER_ENTERED: {
    label: 'User-entered',
    description:
      'Provided by the clinician. Not primary source verified. A licensing or credentialing committee must still confirm.',
    badgeClass: 'border-sky-500/40 bg-sky-500/10 text-sky-600',
  },
  INFERRED: {
    label: 'Inferred',
    description:
      'Derived from indirect signals (publication matching, taxonomy heuristics). Not a verified claim.',
    badgeClass: 'border-amber-500/40 bg-amber-500/10 text-amber-700',
  },
  UNKNOWN: {
    label: 'Unknown',
    description: 'No data on file from any source. Neutral — not evidence of absence.',
    badgeClass: 'border-slate-400/40 bg-slate-500/10 text-slate-500',
  },
  CONFLICT: {
    label: 'Conflict',
    description:
      'Two or more sources disagree on this field. Surfaced so a reviewer can resolve it rather than pick silently.',
    badgeClass: 'border-red-500/40 bg-red-500/10 text-red-600',
  },
};

export interface ProfileField<T> {
  value: T;
  provenance: ProfileProvenance;
  sourceLabel?: string;
  lastUpdated?: string;
  confidence?: string;
  limitationNote?: string;
}

/**
 * Small helper for the UI: given a raw value and the provenance tag,
 * fall back to "Unknown" and UNKNOWN when the value is missing
 * regardless of the caller's claim. Keeps missing-data honest even
 * if a caller passes the wrong tag.
 */
export function normalizeFieldProvenance(
  value: string | number | null | undefined,
  claimed: ProfileProvenance,
): { display: string; provenance: ProfileProvenance } {
  const isMissing =
    value === null
    || value === undefined
    || (typeof value === 'string' && value.trim().length === 0);
  if (isMissing) {
    return { display: 'Unknown', provenance: 'UNKNOWN' };
  }
  return { display: String(value), provenance: claimed };
}
