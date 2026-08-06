/**
 * The shape the clinician-profile API answers with — Wave 1076 B1.
 *
 * A structural mirror of the backend's `ProfileView`, not a second definition
 * of the product's rules. Everything that decides anything — which fields
 * exist, what each one supports, which are required, which are still missing,
 * what state the profile is in, and what that state permits — is computed on
 * the server and read here. The surface renders the answer; it does not form
 * its own opinion and it never recomputes activation.
 *
 * `fieldSpecs` travels in the response for exactly that reason: the registry is
 * canonical, and a UI copy of it would drift the first time a field changed.
 */

/** Where a single value came from. Never collapsed into one badge. */
export type TruthClass =
  | 'public_source'
  | 'clinician_provided'
  | 'ownership_verified'
  | 'employer_reviewed';

export type ActivationState =
  | 'resolved'
  | 'profile_saved'
  | 'ownership_verified'
  | 'employer_reviewed'
  | 'ready_to_start';

export type FieldOrigin = 'public_source_correctable' | 'clinician_only';

export interface ProfileFieldSpec {
  key: string;
  label: string;
  /** The product outcome this field supports, as the server states it. */
  supports: string;
  origin: FieldOrigin;
  required: boolean;
  freeText: boolean;
}

export interface ResolvedField {
  key: string;
  value: unknown;
  truthClass: TruthClass;
  /** Which registry answered, for public-source values. */
  source?: string;
  observedAt?: string;
}

export interface ProfilePermissions {
  reusableProfile: boolean;
  opportunityDiscovery: boolean;
  selfAttestedSharing: boolean;
  /** Ownership only. A save never unlocks this. */
  privateCredentialHoldings: boolean;
}

export interface ProfileView {
  npi: string;
  state: ActivationState;
  /** The honest sentence for this state, authored server-side. */
  disclosure: string;
  fields: ResolvedField[];
  missingRequired: string[];
  reviewedAt: string | null;
  sharingConfirmedAt: string | null;
  savedAt: string | null;
  activatedAt: string | null;
  permissions: ProfilePermissions;
  fieldSpecs: ProfileFieldSpec[];
}

/** The value as the input should show it. Lists are edited as `CA, TX`. */
export function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(', ');
  if (value === null || value === undefined) return '';
  return String(value);
}

export function fieldSpec(view: ProfileView, key: string): ProfileFieldSpec | undefined {
  return view.fieldSpecs.find((s) => s.key === key);
}

export function fieldFor(view: ProfileView, key: string): ResolvedField | undefined {
  return view.fields.find((f) => f.key === key);
}

/**
 * Has the clinician done every part they control?
 *
 * Read from the server's own timestamps, never inferred from local UI state —
 * a surface that decided this for itself could show an activated profile that
 * the server never activated.
 */
export function activationConditions(view: ProfileView) {
  return {
    reviewed: view.reviewedAt !== null,
    sharingConfirmed: view.sharingConfirmedAt !== null,
    saved: view.savedAt !== null,
    activated: view.activatedAt !== null,
  };
}
