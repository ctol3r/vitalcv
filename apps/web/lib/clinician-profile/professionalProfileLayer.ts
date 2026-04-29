/**
 * FOUNDATION-SWEEP-5 — professional profile layer foundation.
 *
 * Truth invariants:
 *   1. LinkedIn-style and Doximity-style are UX / profile-layer
 *      CONCEPTS, not integrations. They organize how information is
 *      presented; they do NOT pull data from those services.
 *   2. Profile signals require provenance — every signal carries a
 *      `provenance` field consistent with the existing 5-tier
 *      vocabulary.
 *   3. The profile layer NEVER verifies credentials by itself. The
 *      typed `verifiesCredentials: false` invariant is renderable.
 */

export type ProfessionalProfileLayerKind =
  | 'linkedin_style'
  | 'doximity_style'
  | 'research_publication'
  | 'employer_affiliation'
  | 'credential_readiness';

export type ProfessionalProfileLayerStatus =
  | 'foundation_planned'
  | 'foundation_in_progress'
  | 'foundation_baseline_met'
  | 'unavailable';

export type ProfileSignalProvenance =
  | 'VERIFIED'
  | 'USER_ENTERED'
  | 'INFERRED'
  | 'UNKNOWN'
  | 'CONFLICT';

export interface ProfessionalProfileSignal {
  /** Stable id used by the UI for rendering and tests. */
  id: string;
  layer: ProfessionalProfileLayerKind;
  label: string;
  /** Plain-language one-line description of the signal. */
  description: string;
  /** Always required — a signal without provenance does not ship. */
  provenance: ProfileSignalProvenance;
}

export interface ProfessionalProfileLayerSpec {
  layer: ProfessionalProfileLayerKind;
  label: string;
  description: string;
  status: ProfessionalProfileLayerStatus;
  /** Does this layer verify credentials by itself? Always false. */
  verifiesCredentials: false;
}

export interface ProfessionalProfileLayerPlan {
  /** Does any layer in this plan verify credentials by itself? Always false. */
  verifiesCredentials: false;
  layers: ProfessionalProfileLayerSpec[];
  /** Sample signals (for the route to render); each carries provenance. */
  sampleSignals: ProfessionalProfileSignal[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const LAYER_DEFS: Array<{
  layer: ProfessionalProfileLayerKind;
  label: string;
  description: string;
}> = [
  {
    layer: 'linkedin_style',
    label: 'LinkedIn-style profile layer',
    description:
      'Career-history presentation modeled on what clinicians expect from LinkedIn. UI/UX layer only — no LinkedIn data is pulled.',
  },
  {
    layer: 'doximity_style',
    label: 'Doximity-style profile layer',
    description:
      'Clinical-network presentation modeled on what clinicians expect from Doximity. UI/UX layer only — no Doximity data is pulled.',
  },
  {
    layer: 'research_publication',
    label: 'Research / publication layer',
    description:
      'Renders the publication-candidate set from the research foundation. Every entry carries provenance and is never verified by display alone.',
  },
  {
    layer: 'employer_affiliation',
    label: 'Employer / affiliation layer',
    description:
      'Renders employment + affiliations from the clinician profile foundation. Provenance-tagged; verification is a separate path.',
  },
  {
    layer: 'credential_readiness',
    label: 'Credential readiness layer',
    description:
      'Renders the credential-readiness summary from the trust-state foundation. Does not assert verification.',
  },
];

const DISCLAIMERS = [
  'Profile-layer signals organize information; they do not verify credentials by themselves.',
  'LinkedIn-style and Doximity-style are presentation concepts, not integrations.',
  'Every profile signal carries provenance; missing data is UNKNOWN, not a default to verified.',
];

const SAMPLE_SIGNALS: ProfessionalProfileSignal[] = [
  {
    id: 'sig-1',
    layer: 'linkedin_style',
    label: 'Most recent role',
    description: 'Renders the most recent employment entry from the clinician profile.',
    provenance: 'USER_ENTERED',
  },
  {
    id: 'sig-2',
    layer: 'doximity_style',
    label: 'Hospital affiliations',
    description: 'Renders affiliation entries; affiliation provenance is per-entry.',
    provenance: 'USER_ENTERED',
  },
  {
    id: 'sig-3',
    layer: 'research_publication',
    label: 'Publication candidate count',
    description: 'Counts unmatched + matched-pending-review + user-entered candidates.',
    provenance: 'INFERRED',
  },
  {
    id: 'sig-4',
    layer: 'employer_affiliation',
    label: 'Current employer',
    description: 'Renders the current employer entry; provenance is per-entry.',
    provenance: 'USER_ENTERED',
  },
  {
    id: 'sig-5',
    layer: 'credential_readiness',
    label: 'Readiness summary',
    description: 'Surfaces the profile completion summary. Filled-ness, not verification.',
    provenance: 'INFERRED',
  },
];

export function buildProfessionalProfileLayerPlan(): ProfessionalProfileLayerPlan {
  const layers: ProfessionalProfileLayerSpec[] = LAYER_DEFS.map((d) => ({
    layer: d.layer,
    label: d.label,
    description: d.description,
    status: 'foundation_planned',
    verifiesCredentials: false,
  }));
  return {
    verifiesCredentials: false,
    layers,
    sampleSignals: SAMPLE_SIGNALS.map((s) => ({ ...s })),
    disclaimers: [...DISCLAIMERS],
  };
}

export function explainProfessionalProfileLayer(layer: ProfessionalProfileLayerKind): string {
  const def = LAYER_DEFS.find((d) => d.layer === layer);
  if (!def) throw new Error(`Unknown profile layer: ${layer}`);
  return def.description;
}
