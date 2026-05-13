import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * CheckedAtStamp — canonical visible-timestamp primitive.
 *
 * Renders an ISO-8601 timestamp as visible text (not `aria-only`, not
 * `title` tooltip, not `data-*` metadata). This is intentional: per the
 * Lane A audit, hospital verifiers need to read the freshness of a
 * check within ~30 seconds, and tooltip-only timestamps fail that test.
 *
 * Format:
 *   - 'short'  → `2026-05-12`             (date-only, default)
 *   - 'long'   → `2026-05-12 14:23 UTC`   (date + minute precision, UTC)
 *   - 'iso'    → `2026-05-12T14:23:11Z`   (full ISO, monospaced)
 *
 * The label slot ("Checked", "Verified", "Observed") is caller-owned so
 * the primitive doesn't impose a single verb across surfaces.
 */
export type CheckedAtFormat = 'short' | 'long' | 'iso';

export interface CheckedAtStampProps {
  /** ISO-8601 timestamp. `null` / `undefined` renders the no-check state. */
  checkedAt: string | null | undefined;
  /** Prefix label. Defaults to "Checked". */
  label?: string;
  /** Display format. Defaults to 'long'. */
  format?: CheckedAtFormat;
  /** Optional freshness window in milliseconds. When set, a `stale` indicator
   *  is appended if `now - checkedAt > freshnessWindowMs`. */
  freshnessWindowMs?: number;
  /** Optional class hook for the outer span. */
  className?: string;
}

function formatCheckedAt(iso: string, format: CheckedAtFormat): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  if (format === 'iso') {
    return date.toISOString();
  }
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  if (format === 'short') {
    return `${y}-${m}-${d}`;
  }
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm} UTC`;
}

export function CheckedAtStamp({
  checkedAt,
  label = 'Checked',
  format = 'long',
  freshnessWindowMs,
  className,
}: CheckedAtStampProps): React.ReactElement {
  if (!checkedAt) {
    return (
      <span
        className={cn('inline-flex items-baseline gap-1.5 text-xs text-muted-foreground', className)}
        data-checked-at="none"
      >
        <span className="uppercase tracking-wide">{label}</span>
        <span className="font-mono">never</span>
      </span>
    );
  }

  const formatted = formatCheckedAt(checkedAt, format);
  const isStale =
    typeof freshnessWindowMs === 'number'
    && Number.isFinite(new Date(checkedAt).getTime())
    && Date.now() - new Date(checkedAt).getTime() > freshnessWindowMs;

  return (
    <span
      className={cn('inline-flex items-baseline gap-1.5 text-xs', className)}
      data-checked-at={checkedAt}
      data-stale={isStale ? 'true' : 'false'}
    >
      <span className="uppercase tracking-wide text-muted-foreground">{label}</span>
      <time className="font-mono text-foreground" dateTime={checkedAt}>
        {formatted}
      </time>
      {isStale && (
        <span className="font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400">
          stale
        </span>
      )}
    </span>
  );
}
