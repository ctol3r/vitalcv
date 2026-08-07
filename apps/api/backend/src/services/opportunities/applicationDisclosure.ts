import { HttpError } from '../../utils/httpError';

/**
 * Sections supported by the canonical packet builder. Identity is required so
 * an employer can attribute the exact packet they received; every other
 * section is a clinician-controlled disclosure choice.
 */
export const APPLICATION_DISCLOSURE_SECTIONS = [
  'identity',
  'exclusions',
  'licensure',
  'enrollment',
] as const;

export type ApplicationDisclosureSection = (typeof APPLICATION_DISCLOSURE_SECTIONS)[number];

/** Backward-compatible default for callers that predate the composer. */
const DEFAULT_SECTIONS: readonly ApplicationDisclosureSection[] = APPLICATION_DISCLOSURE_SECTIONS;

/**
 * Normalize a clinician-controlled selection before packet construction.
 * Undefined remains the legacy full-disclosure default; an explicit empty or
 * ambiguous selection must never silently expand into more disclosure.
 */
export function resolveDisclosureSections(
  selectedSections: unknown,
): ApplicationDisclosureSection[] {
  if (selectedSections === undefined) {
    return [...DEFAULT_SECTIONS];
  }

  if (!Array.isArray(selectedSections) || selectedSections.some((section) => typeof section !== 'string')) {
    throw new HttpError(400, 'The requested disclosure must be a list of supported sections.');
  }

  const selected = [...new Set(selectedSections.map((section) => section.trim()))];
  if (selected.length === 0) {
    throw new HttpError(400, 'Choose at least the required identity section before applying.');
  }

  const unknown = selected.filter(
    (section) => !APPLICATION_DISCLOSURE_SECTIONS.includes(section as ApplicationDisclosureSection),
  );
  if (unknown.length > 0) {
    throw new HttpError(400, 'The requested disclosure contains an unsupported section.');
  }
  if (!selected.includes('identity')) {
    throw new HttpError(400, 'Identity is required to present an application packet.');
  }

  return selected as ApplicationDisclosureSection[];
}
