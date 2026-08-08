import * as React from 'react';
import { CheckCircle2, Lock, AlertTriangle, MinusCircle, PenLine, Gavel } from 'lucide-react';

import { type EvidenceState, evidenceStateMeta, TONE_COLOR } from '@/lib/vital/evidenceState';

/**
 * StateChip — the canonical evidence-state chip. Shape + text, never color
 * alone (accessibility): each state carries a distinct glyph AND its label, and
 * a check is shown ONLY for affirmative states (source-backed / checked). Gated,
 * review, and unavailable states get lock / alert / dash — never a check.
 *
 * W1082 (UX-02B): the chip is ATTRIBUTED, and attribution is required at the
 * type level. A state word without "who answered, and when" is exactly how
 * 'checked' got conflated with affirmation — so a call site can no longer
 * forget attribution, it can only state explicitly which kind it has:
 *
 *  - `{ source, asOf }` — a source or check answered. `asOf: null` is
 *    first-class: it announces "as-of not recorded" rather than pretending a
 *    timestamp exists. The qualifier lives INSIDE the accessible value, so no
 *    consumer can strip it in a copy pass.
 *  - `'declared'` — the state names its own actor (self-attested → the
 *    clinician; employer decision → the employer; needs review → the flag).
 *    Announces the state's meaning; never invents a source.
 *  - `'legend'` — the chip illustrates the vocabulary itself (the /trust
 *    grammar section). Announced as an example so it is impossible to mistake
 *    for a real result.
 *
 * The visible form is unchanged — the row grammar (chip + adjacent mono
 * source · time line, see EvidenceRow) stays the one layout — but every chip
 * now carries its attribution in its accessible name and title, so a chip
 * encountered alone still answers "says who?".
 */
export type StateChipAttribution =
  | {
      /** Which source or check answered (e.g. "NPPES", "OIG LEIE"). */
      source: string;
      /** Human as-of string — or null, announced as "as-of not recorded". */
      asOf: string | null;
      /** Machine ISO timestamp when one exists. */
      asOfISO?: string;
    }
  | 'declared'
  | 'legend';

const STATE_ICON: Record<EvidenceState, React.ComponentType<{ size?: number; className?: string }>> = {
  source_backed: CheckCircle2,
  checked: CheckCircle2,
  self_attested: PenLine,
  needs_review: AlertTriangle,
  access_required: Lock,
  unavailable: MinusCircle,
  employer_decision: Gavel,
};

/** The one sentence a screen reader (and title tooltip) gets for a chip. */
export function stateChipAccessibleName(state: EvidenceState, attribution: StateChipAttribution): string {
  const meta = evidenceStateMeta(state);
  if (attribution === 'legend') {
    return `${meta.label} — vocabulary example, not a result about anyone`;
  }
  if (attribution === 'declared') {
    return `${meta.label} — ${meta.meaning}`;
  }
  const asOf = attribution.asOf ? `as of ${attribution.asOf}` : 'as-of not recorded';
  return `${meta.label} — ${attribution.source}, ${asOf}`;
}

export function StateChip({
  state,
  attribution,
  size = 'md',
  className,
}: {
  state: EvidenceState;
  attribution: StateChipAttribution;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = evidenceStateMeta(state);
  const Icon = STATE_ICON[state];
  const color = TONE_COLOR[meta.tone];
  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const glyph = size === 'sm' ? 12 : 13;
  const accessibleName = stateChipAccessibleName(state, attribution);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${px} ${className ?? ''}`}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 38%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 9%, transparent)`,
      }}
      title={accessibleName}
      aria-label={accessibleName}
    >
      <Icon size={glyph} aria-hidden="true" />
      <span aria-hidden="true">{meta.label}</span>
    </span>
  );
}

export default StateChip;
