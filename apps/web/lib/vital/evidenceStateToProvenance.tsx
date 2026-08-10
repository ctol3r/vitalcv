/**
 * evidenceStateToProvenance — THE mapping table between the two chip
 * vocabularies (UX-02 Step 3).
 *
 * EC-3 freezes the state vocabulary and says the parallel word lists are
 * "reconciled by UX-02 via one mapping table." This is that table. It exists so
 * `EvidenceState` can stop having its own *chip*, without `EvidenceState`
 * itself being deleted — see the scope note below.
 *
 * ## Why EvidenceState survives
 *
 * The retirement spec called for deleting `EvidenceState` outright. That is
 * wrong, and the audit is why: `EvidenceState` is not only a chip vocabulary,
 * it is a **domain type** embedded in application data —
 * `ApplicationEvidenceField['evidenceState']` (lib/applications/evidenceView),
 * `DecisionContext.byState` (lib/applications/decisionContext), and the
 * apply-intent types. Deleting it would change the data model, which a design
 * consolidation may not do (EC-0).
 *
 * So the duplication that dies is the duplicated **component**, not the domain
 * vocabulary. `components/vital/StateChip` is deleted; `EvidenceState` remains
 * the application-side word list and converts here at the render boundary.
 *
 * ## Labels are preserved deliberately
 *
 * Every mapping carries an explicit `label` that reproduces the word
 * `EVIDENCE_STATE` shows today. `source_backed` renders "Source-backed", not
 * ProvenanceChip's default "Checked". This is not timidity — it is the one
 * genuinely user-visible risk in the whole migration, and changing a customer-
 * facing status word is a copy-review decision, not a side effect of a
 * component swap. When copy review rules, the override comes out here, in one
 * place, rather than across six surfaces.
 *
 * ## The one semantic collapse, recorded
 *
 * `EvidenceState` has TWO affirmative states and ProvenanceChip has one:
 *   - `source_backed` — "a primary source returned this value"
 *   - `checked`       — "a check ran and returned no adverse result"
 * Both map to ProvenanceChip's `checked`. The distinction between *returned
 * your value* and *ran clean* survives in the visible label but not in the
 * underlying state. That is a real loss of resolution and belongs in UX-02's
 * vocabulary reconciliation, not in a silent widening here.
 */
import * as React from 'react';

import type { EvidenceState } from '@/lib/vital/evidenceState';
import {
  ProvenanceChip,
  type ProvenanceAttribution,
  type ProvenanceState,
} from '@/design-system/components/ProvenanceChip';

/** The frozen mapping: one EvidenceState → one ProvenanceState + its label. */
export const EVIDENCE_TO_PROVENANCE: Record<
  EvidenceState,
  { state: ProvenanceState; label: string }
> = {
  source_backed: { state: 'checked', label: 'Source-backed' },
  checked: { state: 'checked', label: 'Checked' },
  self_attested: { state: 'selfAttested', label: 'Self-attested' },
  access_required: { state: 'accessRequired', label: 'Access required' },
  needs_review: { state: 'reviewRequired', label: 'Needs review' },
  unavailable: { state: 'unavailable', label: 'Unavailable' },
  // EC-7: "only an employer can decide this" describes WHO CONTROLS the matter,
  // not what a source returned — a different axis from coverage. ProvenanceChip
  // has no controller state and must not grow one (that would collapse a
  // controller into a coverage word). `reviewRequired` is the honest nearest
  // register — "routed, not decided" is exactly the condition — and the label
  // keeps the controller visible. Modelling controllers properly is a UX-02
  // item, recorded not solved.
  employer_decision: { state: 'reviewRequired', label: 'Employer decision' },
};

/** StateChip's attribution union, kept so call sites migrate unchanged. */
export type EvidenceAttribution =
  | { source: string; asOf: string | null; asOfISO?: string }
  | 'declared'
  | 'legend';

/**
 * Adapt StateChip's attribution to ProvenanceChip's. The three forms are the
 * same three ideas; only the spelling differs.
 */
export function toProvenanceAttribution(
  attribution: EvidenceAttribution,
  state: EvidenceState,
): ProvenanceAttribution {
  if (attribution === 'legend') return { legend: true };
  if (attribution === 'declared') {
    // `declared` announced the state's own meaning and named nobody. The
    // ProvenanceChip form requires words, so the state's meaning IS the words.
    return { declared: EVIDENCE_TO_PROVENANCE[state].label.toLowerCase() };
  }
  return {
    source: attribution.source,
    asOf: attribution.asOf,
    asOfISO: attribution.asOfISO,
  };
}

export interface EvidenceProvenanceChipProps {
  state: EvidenceState;
  attribution: EvidenceAttribution;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Drop-in replacement for `components/vital/StateChip`: same props, rendered by
 * ProvenanceChip through the mapping above. Existing call sites change their
 * import and nothing else.
 *
 * Geometry is pinned to `pill` deliberately. StateChip rendered `rounded-full`,
 * so pill is what these five surfaces show today; migrating the mechanism and
 * the geometry in one PR would put an unreviewed shape change in front of users
 * on a founder-gated route. EC-20 retires the pill — that flip is its own
 * change, with its own before/after evidence.
 */
export function EvidenceProvenanceChip({
  state,
  attribution,
  size,
  className,
}: EvidenceProvenanceChipProps) {
  const { state: provenanceState, label } = EVIDENCE_TO_PROVENANCE[state];
  return (
    <ProvenanceChip
      state={provenanceState}
      label={label}
      attribution={toProvenanceAttribution(attribution, state)}
      size={size}
      shape="pill"
      // The surrounding row grammar owns the provenance line on every one of
      // these surfaces, exactly as it did under StateChip (which painted none).
      provenanceLine="hidden"
      className={className}
    />
  );
}
