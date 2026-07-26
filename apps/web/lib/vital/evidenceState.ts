// lib/vital/evidenceState.ts
//
// The ONE canonical evidence-state vocabulary the product shares (the doctrine
// states named across both design docs). Existing surfaces use several parallel
// badge vocabularies (StatusBadge, trust-status-badge, source-coverage); this is
// the consolidation target the vital components render, and other surfaces move
// onto it wave by wave. No new color tokens — maps onto the existing `--vt-*`.

export type EvidenceState =
  | 'source_backed' // a primary source returned this
  | 'checked' // a check ran and returned no adverse result
  | 'self_attested' // clinician-entered; not source-confirmed
  | 'access_required' // a source exists but we don't have access yet
  | 'needs_review' // flagged for human / employer review
  | 'unavailable' // source temporarily unreachable
  | 'employer_decision'; // only an employer/institution can decide this

export type EvidenceTone = 'positive' | 'neutral' | 'attention' | 'gated' | 'muted';

interface EvidenceStateMeta {
  /** Short label shown in a chip (Title Case). */
  label: string;
  tone: EvidenceTone;
  /**
   * Whether a positive glyph (check) is allowed. Gated/unavailable/review states
   * MUST NOT show a check — a check may only mean "a source backed this".
   */
  affirmative: boolean;
  /** One plain sentence of what the state means (for tooltips / a11y). */
  meaning: string;
}

export const EVIDENCE_STATE: Record<EvidenceState, EvidenceStateMeta> = {
  source_backed: {
    label: 'Source-backed',
    tone: 'positive',
    affirmative: true,
    meaning: 'A primary source returned this value.',
  },
  checked: {
    label: 'Checked',
    tone: 'positive',
    affirmative: true,
    meaning: 'A check ran against the source and returned no adverse result.',
  },
  self_attested: {
    label: 'Self-attested',
    tone: 'neutral',
    affirmative: false,
    meaning: 'Entered by the clinician; not yet confirmed by a source.',
  },
  needs_review: {
    label: 'Needs review',
    tone: 'attention',
    affirmative: false,
    meaning: 'Flagged for human or employer review before it can be relied on.',
  },
  access_required: {
    label: 'Access required',
    tone: 'gated',
    affirmative: false,
    meaning: 'A source exists but VitalCV does not have access to it yet.',
  },
  unavailable: {
    label: 'Unavailable',
    tone: 'muted',
    affirmative: false,
    meaning: 'The source is temporarily unreachable; nothing was returned.',
  },
  employer_decision: {
    label: 'Employer decision',
    tone: 'attention',
    affirmative: false,
    meaning: 'Only an employer or institution can decide this.',
  },
};

/** The CSS color a tone resolves to (existing --vt-* tokens; theme-aware). */
export const TONE_COLOR: Record<EvidenceTone, string> = {
  positive: 'var(--vt-accent-emerald)',
  neutral: 'var(--vt-text-secondary)',
  attention: 'var(--vt-state-stale, #a2670b)',
  gated: 'var(--vt-state-stale, #a2670b)',
  muted: 'var(--vt-text-muted)',
};

export function evidenceStateMeta(state: EvidenceState): EvidenceStateMeta {
  return EVIDENCE_STATE[state];
}
