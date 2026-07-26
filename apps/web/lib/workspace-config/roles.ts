/**
 * Role-based projection engine (Wave 1300, C2)
 * ──────────────────────────────────────────────────────────────────────────
 * Projects the canonical Career Model (W1000) for a workspace role. A role
 * controls VISIBILITY only: which sections a role sees. It can NEVER alter,
 * fabricate, or elevate the underlying facts — visible sections are passed
 * through by reference, unchanged. Hiding a section omits it; it never zeroes,
 * fakes, or inflates trust. No role can see more decision-grade evidence than
 * actually exists, because the values are the same objects the model produced.
 *
 * Pure: a projection over an already-composed model. No trust math, no I/O.
 */
import type { CareerModel, CareerIdentity, CareerModelMeta } from '@vitalcv/domain-evidence';

/** The gateable sections of the Career Model. identity + meta are always visible. */
export type CareerSection =
  | 'evidence'
  | 'trust'
  | 'timeline'
  | 'mobility'
  | 'readiness'
  | 'organizations'
  | 'growth'
  | 'intelligence'
  | 'longitudinal';

export const CAREER_SECTIONS: readonly CareerSection[] = [
  'evidence',
  'trust',
  'timeline',
  'mobility',
  'readiness',
  'organizations',
  'growth',
  'intelligence',
  'longitudinal',
] as const;

export interface RoleProjection {
  roleId: string;
  identity: CareerIdentity;
  /** Pass-through model meta (content hash, decision-grade counts). */
  meta: CareerModelMeta;
  visibleSections: CareerSection[];
  hiddenSections: CareerSection[];
  /** Only the visible sections, by reference — values are never modified. */
  sections: Partial<Pick<CareerModel, CareerSection>>;
}

function isCareerSection(value: string): value is CareerSection {
  return (CAREER_SECTIONS as readonly string[]).includes(value);
}

/**
 * Project a model for a role. `allowedSections` is the role's visibility grant;
 * unknown keys are ignored. Visible sections are copied by reference (unchanged);
 * everything else is reported as hidden. identity + meta always pass through.
 */
export function projectForRole(
  model: CareerModel,
  roleId: string,
  allowedSections: readonly string[],
): RoleProjection {
  const allowed = new Set(allowedSections.filter(isCareerSection));
  const visibleSections: CareerSection[] = [];
  const hiddenSections: CareerSection[] = [];
  const sections: Partial<Pick<CareerModel, CareerSection>> = {};

  for (const section of CAREER_SECTIONS) {
    if (allowed.has(section)) {
      visibleSections.push(section);
      // Pass-through by reference — the role NEVER changes the values.
      (sections as Record<CareerSection, unknown>)[section] = model[section];
    } else {
      hiddenSections.push(section);
    }
  }

  return {
    roleId,
    identity: model.identity,
    meta: model.meta,
    visibleSections,
    hiddenSections,
    sections,
  };
}
