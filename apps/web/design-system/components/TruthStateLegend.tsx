import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  TruthStateChip,
  TRUTH_STATE_META,
  TRUTH_STATE_ORDER,
  type TruthStateKind,
} from './TruthStateChip';

/**
 * TruthStateLegend — the canonical key for the truth-state chip vocabulary.
 *
 * Two shapes:
 *   - the full 8-row legend (every chip variant), useful on `/status` or
 *     `/trust/attribution` where viewers see the entire vocabulary at once.
 *   - the 5-row Passport legend (`PASSPORT_LEGEND_ROWS` below), which is
 *     the trimmed vocabulary surfaced on the public Passport view.
 *
 * Default is the 5-row Passport legend because that is the most common
 * call site. Pass `rows="all"` for the full 8.
 */

/** A single legend row — a chip + the operator-friendly meaning string. */
export interface TruthStateLegendRow {
  /** The truth state to render for this row. */
  state: TruthStateKind;
  /**
   * Override the default `TRUTH_STATE_META[state].description`. Caller
   * is responsible for copy review (banned-strings list).
   */
  meaning?: string;
  /**
   * Optional one-line example, surfaced under the meaning text. Useful for
   * showing the operator how a given state appears in practice.
   */
  example?: string;
}

/**
 * The 5-row Passport legend, in the order the Passport surface shows them.
 *
 *   1. known                 → source-backed
 *   2. source-backed where   → snapshot-only        (system holds a
 *      available                                       point-in-time read)
 *   3. unavailable / gated   → temporarily-unavailable
 *   4. awaiting institution  → institution-review-required
 *      review
 *   5. next step             → access-required        (when caller-action
 *                                                       is the next step)
 *
 * Wave H may swap row 5 to `auth-required` when the call site renders the
 * unauthenticated public Passport (where sign-in is the next step). The
 * default here matches the *authenticated* Passport surface — most rows.
 */
export const PASSPORT_LEGEND_ROWS: ReadonlyArray<TruthStateLegendRow> =
  Object.freeze([
    { state: 'source-backed' },
    { state: 'snapshot-only' },
    { state: 'temporarily-unavailable' },
    { state: 'institution-review-required' },
    { state: 'access-required' },
  ] as const);

/**
 * The full 8-row legend, in `TRUTH_STATE_ORDER` (the operator-friendly
 * default order).
 */
export const FULL_LEGEND_ROWS: ReadonlyArray<TruthStateLegendRow> = Object.freeze(
  TRUTH_STATE_ORDER.map((state) => ({ state })),
);

export interface TruthStateLegendProps {
  /**
   * Rows to render. Pass `'passport'` for the 5-row Passport legend
   * (default), `'all'` for the full 8-row legend, or an explicit array
   * for a custom legend (e.g. on `/status` you might want only the four
   * states that apply to connector rows).
   */
  rows?: 'passport' | 'all' | ReadonlyArray<TruthStateLegendRow>;
  /** Stacked (default) for prose-heavy surfaces or compact for chrome. */
  layout?: 'stack' | 'compact';
  /** Optional heading shown above the legend. Omitted by default. */
  heading?: string;
  className?: string;
}

function resolveRows(
  rows: TruthStateLegendProps['rows'],
): ReadonlyArray<TruthStateLegendRow> {
  if (rows === 'all') return FULL_LEGEND_ROWS;
  if (rows === undefined || rows === 'passport') return PASSPORT_LEGEND_ROWS;
  return rows;
}

/**
 * Render the canonical truth-state legend.
 */
export function TruthStateLegend({
  rows,
  layout = 'stack',
  heading,
  className,
}: TruthStateLegendProps) {
  const resolved = resolveRows(rows);

  return (
    <section
      aria-label={heading ?? 'Truth state legend'}
      className={cn(
        layout === 'stack'
          ? 'flex flex-col gap-3'
          : 'flex flex-wrap items-start gap-x-6 gap-y-3',
        className,
      )}
    >
      {heading && (
        <h2 className="text-[length:var(--vt-type-caption-size)] font-[var(--vt-font-weight-semibold)] uppercase tracking-[0.16em] text-[var(--vt-text-secondary)]">
          {heading}
        </h2>
      )}
      <ul
        role="list"
        className={cn(
          layout === 'stack'
            ? 'flex flex-col gap-3'
            : 'flex flex-wrap items-start gap-x-6 gap-y-3',
        )}
      >
        {resolved.map((row) => {
          const meta = TRUTH_STATE_META[row.state];
          return (
            <li
              key={row.state}
              className={cn(
                'flex',
                layout === 'stack' ? 'items-start gap-3' : 'items-center gap-2',
              )}
            >
              <TruthStateChip state={row.state} size="sm" />
              <div className="text-[length:var(--vt-type-body-size,14px)] text-[var(--vt-text-secondary)]">
                <span className="block">{row.meaning ?? meta.description}</span>
                {row.example && (
                  <span className="mt-1 block text-[length:var(--vt-type-caption-size,12px)] text-[var(--vt-text-tertiary,var(--vt-text-secondary))] opacity-80">
                    {row.example}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
