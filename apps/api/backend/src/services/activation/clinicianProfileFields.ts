/**
 * The minimum clinician profile — Wave 1076 B1.
 *
 * Every field here earns its place by supporting a product outcome the
 * activation decision names. Fields were derived from what the matching engine
 * and the share surface ACTUALLY read (`ClinicianProfile` in matchaModels.ts:
 * name, specialty, states, credentials), not from what a credentialing form
 * would ask for.
 *
 * This is deliberately not a credentialing-complete profile. The instruction is
 * explicit: include only what identifies the profile, supports basic role
 * matching, supports a truthful clinician-controlled share, and prevents
 * re-entering foundational information.
 */

import type { TruthClass } from './clinicianProfileState';

export type FieldOrigin =
  /** NPPES can answer this; the clinician may correct it. */
  | 'public_source_correctable'
  /** No public source answers this; only the clinician can. */
  | 'clinician_only';

export interface ProfileFieldSpec {
  key: string;
  label: string;
  /** The product outcome this field supports. If it supports none, it is cut. */
  supports: string;
  origin: FieldOrigin;
  required: boolean;
  /** Free text the clinician may type; excluded from analytics payloads. */
  freeText: boolean;
}

export const PROFILE_FIELDS: readonly ProfileFieldSpec[] = [
  {
    key: 'fullName',
    label: 'Name',
    supports: 'Identifies the professional profile; the employer must know whose profile arrived.',
    origin: 'public_source_correctable',
    required: true,
    freeText: true,
  },
  {
    key: 'credential',
    label: 'Credential',
    supports: 'Identifies the profile (NP, PA-C, MD) and is the first thing an employer filters on.',
    origin: 'public_source_correctable',
    required: true,
    freeText: true,
  },
  {
    key: 'specialty',
    label: 'Specialty',
    supports: 'Role matching — the engine reads `profile.specialty` directly.',
    origin: 'public_source_correctable',
    required: true,
    freeText: true,
  },
  {
    key: 'practiceState',
    label: 'Practice location',
    supports: 'Role matching — the engine reads `profile.states`.',
    origin: 'public_source_correctable',
    required: true,
    freeText: false,
  },
  {
    key: 'licensedStates',
    label: 'States you are licensed in',
    supports:
      'Role matching across states. NPPES reports at most a self-reported licence state, so this is where a clinician stops re-entering it for every application.',
    origin: 'public_source_correctable',
    required: false,
    freeText: false,
  },
  {
    key: 'preferredStates',
    label: 'Where you want to work',
    supports: 'Role relevance — no public source knows this, and without it matching guesses.',
    origin: 'clinician_only',
    required: false,
    freeText: false,
  },
  {
    key: 'workArrangement',
    label: 'Work arrangement',
    supports: 'Role relevance — full-time, part-time, locums, additional role.',
    origin: 'clinician_only',
    required: false,
    freeText: false,
  },
  {
    key: 'contactEmail',
    label: 'Contact email',
    supports:
      'A truthful share needs a reply path. Without it the employer receives a profile they cannot respond to.',
    origin: 'clinician_only',
    required: true,
    freeText: true,
  },
] as const;

export const REQUIRED_FIELD_KEYS = PROFILE_FIELDS.filter((f) => f.required).map((f) => f.key);
export const FREE_TEXT_FIELD_KEYS = PROFILE_FIELDS.filter((f) => f.freeText).map((f) => f.key);
const FIELD_KEYS = new Set(PROFILE_FIELDS.map((f) => f.key));

export function isProfileField(key: string): boolean {
  return FIELD_KEYS.has(key);
}

/**
 * Drop anything that is not a declared field.
 *
 * An allowlist, not a filter: a client may not persist arbitrary keys into a
 * record whose whole purpose is that every value's origin is known.
 */
export function pickProfileFields(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (isProfileField(k) && v !== undefined) out[k] = v;
  }
  return out;
}

export interface ResolvedField {
  key: string;
  value: unknown;
  truthClass: TruthClass;
  /** Which registry answered, for public-source values. */
  source?: string;
  observedAt?: string;
}

/**
 * Merge the public-source snapshot with the clinician's changes WITHOUT losing
 * which is which.
 *
 * The clinician's value wins for display — they corrected it, and a correction
 * that does not take is not a correction. What must not happen is the merged
 * value inheriting `public_source`: the moment a clinician edits a field, that
 * field is their statement, and every downstream surface has to be able to say
 * so.
 */
export function mergeProfile(
  resolvedSnapshot: Record<string, unknown>,
  clinicianFields: Record<string, unknown>,
  observations: Record<string, { source?: string; observedAt?: string }> = {},
): ResolvedField[] {
  return PROFILE_FIELDS.map((spec) => {
    const edited = Object.prototype.hasOwnProperty.call(clinicianFields, spec.key);
    if (edited) {
      return {
        key: spec.key,
        value: clinicianFields[spec.key],
        truthClass: 'clinician_provided' as TruthClass,
      };
    }
    const obs = observations[spec.key] ?? {};
    return {
      key: spec.key,
      value: resolvedSnapshot[spec.key] ?? null,
      truthClass: 'public_source' as TruthClass,
      source: obs.source,
      observedAt: obs.observedAt,
    };
  }).filter((f) => f.value !== null && f.value !== undefined && f.value !== '');
}

/** Which required fields are still empty after the merge. */
export function missingRequired(fields: ResolvedField[]): string[] {
  const present = new Set(fields.map((f) => f.key));
  return REQUIRED_FIELD_KEYS.filter((k) => !present.has(k));
}
