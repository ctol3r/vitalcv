import * as React from 'react';
import { CheckCircle2, Lock, AlertTriangle, MinusCircle, PenLine, Gavel } from 'lucide-react';

import { type EvidenceState, evidenceStateMeta, TONE_COLOR } from '@/lib/vital/evidenceState';

/**
 * TrustGlyph — a single evidence-state glyph that is ALWAYS labelled (there are
 * no bare truth glyphs) and never shows a check for gated/unavailable evidence.
 * Use inline next to a value where a full StateChip is too heavy; the label can
 * be visually hidden but stays in the accessibility tree.
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

export function TrustGlyph({
  state,
  size = 15,
  labelHidden = false,
  className,
}: {
  state: EvidenceState;
  size?: number;
  /** Hide the label visually (still read by screen readers) — never icon-only. */
  labelHidden?: boolean;
  className?: string;
}) {
  const meta = evidenceStateMeta(state);
  const Icon = STATE_ICON[state];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className ?? ''}`} style={{ color: TONE_COLOR[meta.tone] }}>
      <Icon size={size} aria-hidden="true" />
      <span className={labelHidden ? 'sr-only' : 'text-[12px] font-medium'}>{meta.label}</span>
    </span>
  );
}

export default TrustGlyph;
