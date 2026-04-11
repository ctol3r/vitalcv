/**
 * FieldConfidenceBadge
 * ───────────────
 * Shared, canonical primitive for rendering a field-level confidence marker.
 *
 * This is the ONLY sanctioned place in the web app that may render a
 * confidence glyph or label. ProfileView — and any future surface that shows
 * on-device AI enrichment next to source-verified data — must render through
 * this component, not inline. That invariant protects a compliance posture:
 *
 *     "No field renders without a confidence badge."
 *
 * Intentional non-goals:
 *   - NOT a check-level NCQA status badge. DecisionBlock owns YES/CONDITIONAL/NO
 *     verdicts and VERIFIED/PENDING/NOT_VERIFIED per-check status. This badge
 *     answers a different question: "is this single datum source-verified,
 *     AI-inferred, or unknown?" Keep the two systems separate.
 *   - NOT a tooltip host for rich content. The tooltip is a one-line compliance
 *     disclaimer. If future surfaces need richer hover content, promote to a
 *     Radix/Tooltip implementation at that time — don't widen this primitive.
 *
 * Server-component-safe: no 'use client' directive, no state, no effects.
 * Can be composed into either RSC or client component trees.
 */

import type { ConfidenceType } from '@domain-common/dataConfidence';

import type { FieldConfidenceView } from '@/lib/profile/confidenceView';

// ── Display label ──────────────────────────────────────────────────────────
//
// The raw `view.label` from `viewField` is the data-layer label
// ('Verified' / 'Inferred' / 'Unknown'). For the inferred case the UX spec
// requires a buyer-facing clarifier so the "this came from AI" provenance is
// legible at a glance. Appending "(AI)" here — rather than in the projection —
// keeps the data model clean (tests, analytics, a11y labels can still key off
// the raw "Inferred" string) while guaranteeing the clarifier shows anywhere
// the badge is rendered.

const DISPLAY_LABEL: Readonly<Record<ConfidenceType, string>> = Object.freeze({
  verified: 'Verified',
  inferred: 'Inferred (AI)',
  unknown: 'Unknown',
});

// ── Tone classes ───────────────────────────────────────────────────────────
//
// Static class strings keyed by confidence type so no inline style object is
// allocated per render (see react-best-practices: rerender-memo-with-default-value,
// rendering-hoist-jsx).
//
// Palette notes:
//   - verified → emerald: matches DecisionBlock's VERIFIED tone for visual
//     continuity across the "verified" vocabulary the product uses.
//   - inferred → amber: signals "not authoritative, review if it matters."
//     Shared with DecisionBlock's PENDING tone on purpose — both mean
//     "partial trust."
//   - unknown  → zinc: explicitly NOT rose. Unknown is absence of a source,
//     not rejection. DecisionBlock owns rose for NOT_VERIFIED (disqualifying).

const TONE: Readonly<Record<ConfidenceType, string>> = Object.freeze({
  verified:
    'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-300',
  inferred:
    'border-amber-500/30 bg-amber-500/[0.08] text-amber-300',
  unknown:
    'border-zinc-500/30 bg-zinc-500/[0.06] text-zinc-400',
});

// ── Props ──────────────────────────────────────────────────────────────────

export interface FieldConfidenceBadgeProps {
  /** The projected view produced by `viewField`. */
  view: FieldConfidenceView<unknown>;
  /**
   * Optional density override. `'default'` is the full pill shown next to
   * field values in ProfileView; `'compact'` drops the text label to a pure
   * glyph (useful for dense summary rows where space is at a premium).
   */
  density?: 'default' | 'compact';
  /** Extra classes for layout-only tweaks (spacing, alignment). */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────────

export function FieldConfidenceBadge({
  view,
  density = 'default',
  className,
}: FieldConfidenceBadgeProps) {
  const tone = TONE[view.type];
  const displayLabel = DISPLAY_LABEL[view.type];

  // The a11y label intentionally combines the data-layer label ('Inferred')
  // with the compliance tooltip so screen readers get the full posture,
  // not just the glyph. Visual users see the "(AI)" clarifier; screen-reader
  // users hear the clarifier via the tooltip body.
  const a11yLabel = `${view.label}: ${view.tooltip}`;

  return (
    <span
      role="status"
      aria-label={a11yLabel}
      title={view.tooltip}
      data-confidence={view.type}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5',
        'font-mono text-[10px] font-bold uppercase tracking-[0.14em]',
        'select-none align-middle',
        tone,
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span aria-hidden="true" className="text-[11px] leading-none">
        {view.glyph}
      </span>
      {density === 'default' && <span>{displayLabel}</span>}
    </span>
  );
}
