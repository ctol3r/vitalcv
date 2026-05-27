import * as React from 'react';
import { TRUTH_STATE_LABEL, type TruthState } from './types';

/**
 * Compound truth chip — the canonical form. NEVER renders bare.
 *
 * The `source` prop is required by the type system. This makes the chat22
 * ship-blocker #1 ("Sources disagree" + "Not asserted" rendering bare)
 * a type error rather than a visual bug.
 *
 * Use `LegendTruthChip` (different component) when you genuinely need
 * a single-segment chip in a legend, and pair it with adjacent context
 * — never on its own.
 */
export type TruthChipProps = {
  state: TruthState;
  /** The compound chip's second segment — source name + age. Required. */
  source: string;
  /** Override the default state label. */
  label?: string;
  className?: string;
};

export function TruthChip({ state, source, label, className }: TruthChipProps) {
  const resolvedLabel = label ?? TRUTH_STATE_LABEL[state];
  return (
    <span
      className={`vs-truth${className ? ` ${className}` : ''}`}
      data-state={state}
    >
      <span className="vs-st">
        <span className="vs-glyph" />
        {resolvedLabel}
      </span>
      <span className="vs-src">{source}</span>
    </span>
  );
}

/**
 * Single-segment legend chip — only for legends/keys where the chip
 * itself is the explanation. The accompanying card/description provides
 * the source context that the compound form would otherwise carry.
 */
export type LegendChipProps = {
  state: TruthState;
  label?: string;
  className?: string;
};

export function LegendChip({ state, label, className }: LegendChipProps) {
  const resolvedLabel = label ?? TRUTH_STATE_LABEL[state];
  return (
    <span
      className={`vs-chip${className ? ` ${className}` : ''}`}
      data-state={state}
    >
      <span className="vs-glyph" />
      {resolvedLabel}
    </span>
  );
}
