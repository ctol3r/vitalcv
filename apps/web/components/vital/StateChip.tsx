import * as React from 'react';
import { CheckCircle2, Lock, AlertTriangle, MinusCircle, PenLine, Gavel } from 'lucide-react';

import { type EvidenceState, evidenceStateMeta, TONE_COLOR } from '@/lib/vital/evidenceState';

/**
 * StateChip — the canonical evidence-state chip. Shape + text, never color
 * alone (accessibility): each state carries a distinct glyph AND its label, and
 * a check is shown ONLY for affirmative states (source-backed / checked). Gated,
 * review, and unavailable states get lock / alert / dash — never a check.
 */
const STATE_ICON: Record<EvidenceState, React.ComponentType<{ size?: number; className?: string }>> = {
  source_backed: CheckCircle2,
  checked: CheckCircle2,
  self_attested: PenLine,
  needs_review: AlertTriangle,
  access_required: Lock,
  unavailable: MinusCircle,
  employer_decision: Gavel,
};

export function StateChip({
  state,
  size = 'md',
  className,
}: {
  state: EvidenceState;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const meta = evidenceStateMeta(state);
  const Icon = STATE_ICON[state];
  const color = TONE_COLOR[meta.tone];
  const px = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-[11px]';
  const glyph = size === 'sm' ? 12 : 13;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.08em] ${px} ${className ?? ''}`}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 38%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${color} 9%, transparent)`,
      }}
      title={meta.meaning}
    >
      <Icon size={glyph} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

export default StateChip;
