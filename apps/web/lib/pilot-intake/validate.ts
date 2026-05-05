/**
 * Pure validation helper for pilot-intake submissions.
 *
 * Used both by the POST /api/pilot-intake handler and the Vitest
 * suite. No DOM/browser/Node-specific calls — keeps the helper
 * fully isomorphic and unit-testable.
 *
 * Validation strategy is intentionally narrow:
 *   - All fields are trimmed before checking length.
 *   - Email shape: must contain a single '@' separating non-empty
 *     local and domain parts; domain must contain a dot.
 *   - persona must be one of a closed enum.
 *   - description must be present and reasonable length.
 *
 * No throws — returns a discriminated result so the API route can
 * surface field-level errors to the user without exposing internals.
 */

export type PilotIntakePersona =
  | 'cvo'
  | 'payer'
  | 'staffing_exchange'
  | 'health_system'
  | 'individual_clinician'
  | 'other';

export interface PilotIntakeInput {
  fullName: string;
  email: string;
  organization: string;
  persona: PilotIntakePersona;
  description: string;
}

export interface PilotIntakeValidationOk {
  ok: true;
  value: PilotIntakeInput;
}

export interface PilotIntakeValidationErr {
  ok: false;
  errors: Partial<Record<keyof PilotIntakeInput, string>>;
}

const ALLOWED_PERSONAS: ReadonlySet<PilotIntakePersona> = new Set([
  'cvo',
  'payer',
  'staffing_exchange',
  'health_system',
  'individual_clinician',
  'other',
]);

const MAX_DESCRIPTION = 4000;
const MAX_NAME = 200;
const MAX_ORG = 200;
const MAX_EMAIL = 320;

function trimToString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function looksLikeEmail(s: string): boolean {
  if (!s || s.length > MAX_EMAIL) return false;
  const parts = s.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (!domain.includes('.')) return false;
  return true;
}

export function validatePilotIntake(raw: unknown): PilotIntakeValidationOk | PilotIntakeValidationErr {
  const errors: Partial<Record<keyof PilotIntakeInput, string>> = {};
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const fullName = trimToString(obj.fullName);
  const email = trimToString(obj.email);
  const organization = trimToString(obj.organization);
  const personaRaw = trimToString(obj.persona);
  const description = trimToString(obj.description);

  if (!fullName) errors.fullName = 'Required.';
  else if (fullName.length > MAX_NAME) errors.fullName = `Maximum ${MAX_NAME} characters.`;

  if (!email) errors.email = 'Required.';
  else if (!looksLikeEmail(email)) errors.email = 'Enter a valid email address.';

  if (!organization) errors.organization = 'Required.';
  else if (organization.length > MAX_ORG) errors.organization = `Maximum ${MAX_ORG} characters.`;

  if (!personaRaw) errors.persona = 'Required.';
  else if (!ALLOWED_PERSONAS.has(personaRaw as PilotIntakePersona))
    errors.persona = 'Choose one of the listed options.';

  if (!description) errors.description = 'Tell us briefly what you have in mind.';
  else if (description.length > MAX_DESCRIPTION)
    errors.description = `Maximum ${MAX_DESCRIPTION} characters.`;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      fullName,
      email,
      organization,
      persona: personaRaw as PilotIntakePersona,
      description,
    },
  };
}
