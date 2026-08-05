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
/** US state + DC codes. A state list is not free text. */
const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA',
  'RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC',
]);

export const WORK_ARRANGEMENTS = [
  'full_time', 'part_time', 'locums', 'per_diem', 'additional_role',
] as const;

const MAX_TEXT = 120;
const MAX_EMAIL = 254;
const MAX_LIST = 60;

export class FieldValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = 'FieldValidationError';
  }
}

const text = (field: string, v: unknown, max = MAX_TEXT): string => {
  // Objects and arrays are not strings, and coercing them produces
  // "[object Object]" — a value that would persist and look deliberate.
  if (typeof v !== 'string') throw new FieldValidationError(field, `${field} must be text.`);
  const trimmed = v.trim();
  if (!trimmed) throw new FieldValidationError(field, `${field} cannot be empty.`);
  if (trimmed.length > max) throw new FieldValidationError(field, `${field} is too long (max ${max}).`);
  return trimmed;
};

const stateCode = (field: string, v: unknown): string => {
  const raw = text(field, v, 2 + 8).toUpperCase();
  if (!US_STATES.has(raw)) throw new FieldValidationError(field, `${raw} is not a US state code.`);
  return raw;
};

const stateList = (field: string, v: unknown): string[] => {
  const items = Array.isArray(v) ? v : [v];
  if (items.length > MAX_LIST) throw new FieldValidationError(field, `${field} has too many entries.`);
  // Normalized and de-duplicated: "co", "CO" and "CO " are one state.
  return [...new Set(items.map((i) => stateCode(field, i)))];
};

const email = (field: string, v: unknown): string => {
  const raw = text(field, v, MAX_EMAIL).toLowerCase();
  // Deliberately conservative rather than RFC-exhaustive: this exists to catch
  // a typo that would silently make a share unreachable.
  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(raw)) {
    throw new FieldValidationError(field, 'Enter a valid email address.');
  }
  return raw;
};

const oneOf = (field: string, v: unknown, allowed: readonly string[]): string => {
  const raw = text(field, v).toLowerCase();
  if (!allowed.includes(raw)) {
    throw new FieldValidationError(field, `${field} must be one of: ${allowed.join(', ')}.`);
  }
  return raw;
};

/** Per-field value schema. A name allowlist alone lets junk through typed. */
const VALIDATORS: Record<string, (v: unknown) => unknown> = {
  fullName: (v) => text('fullName', v),
  credential: (v) => text('credential', v, 40),
  specialty: (v) => text('specialty', v),
  practiceState: (v) => stateCode('practiceState', v),
  licensedStates: (v) => stateList('licensedStates', v),
  preferredStates: (v) => stateList('preferredStates', v),
  workArrangement: (v) => oneOf('workArrangement', v, WORK_ARRANGEMENTS),
  contactEmail: (v) => email('contactEmail', v),
};

/**
 * Validate and normalize a correction payload.
 *
 * Unknown keys are ignored (the established convention here — the name
 * allowlist already drops them). A DECLARED field with an invalid value is
 * never silently dropped: it throws, because silently discarding a correction
 * the clinician typed is worse than refusing it.
 */
export function validateCorrections(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== 'object') return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!isProfileField(k) || v === undefined) continue;
    out[k] = VALIDATORS[k](v);
  }
  return out;
}

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
