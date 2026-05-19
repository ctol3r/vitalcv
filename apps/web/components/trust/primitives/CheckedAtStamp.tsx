import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * checked_at — when the source-of-record was consulted.
 *
 * Source: Trust Primitives.html §07. Always ISO 8601 UTC plus relative
 * age — never one without the other. Stale facts remain equally legible:
 * degradation marks the border, not the text. The relative line uses
 * institutional verbs (ago, last refresh, since rotate); never "just now".
 */
export interface CheckedAtStampProps {
  /** ISO 8601 timestamp (UTC). Use `null` for unconsulted preview state. */
  iso: string | null;
  /** Relative age string ("10 s ago", "2 m 54 s ago", etc). */
  relative: string;
  /** When true, renders a dashed left border (mode-A defer pattern). */
  degraded?: boolean;
  className?: string;
}

export function CheckedAtStamp({
  iso,
  relative,
  degraded = false,
  className,
}: CheckedAtStampProps) {
  return (
    <div
      data-slot="checked-at"
      data-degraded={degraded ? 'true' : undefined}
      className={cn(
        'pl-2 font-mono text-xs tabular-nums',
        degraded && 'border-l-2 border-dashed border-amber-400',
        className,
      )}
    >
      <div className="text-slate-900">{iso ?? '—'}</div>
      <div className="text-slate-600">{relative}</div>
    </div>
  );
}
