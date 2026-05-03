import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LaneState } from './LaneStateBadge';

export interface FreshnessData {
  /** Whole-day age of the latest observation. `null` means never observed. */
  ageDays: number | null;
  /** Authoritative refresh window for this lane, in whole days. */
  windowDays: number;
  /** Human-readable cadence label, e.g. "Updated hourly", "Refreshed monthly". */
  cadence: string;
}

export interface FreshnessIndicatorProps {
  freshness: FreshnessData;
  /** Lane state — when not 'verified', the indicator falls back to "not observed". */
  state?: LaneState;
  className?: string;
}

/**
 * FreshnessIndicator — trust has a half-life. Renders a monospaced
 * countdown ("valid 14d") or a "stale" marker for any verified lane,
 * with a thin tone-coded progress bar underneath.
 *
 * Three tones:
 *   fresh  — >50% of the window remaining (verified · current)
 *   aging  — within window but past the halfway point
 *   stale  — past the window; observation no longer authoritative
 */
export function FreshnessIndicator({
  freshness,
  state,
  className,
}: FreshnessIndicatorProps) {
  const { ageDays, windowDays, cadence } = freshness;

  // Lanes that have never been observed (or aren't yet checked) get a
  // neutral marker so we don't imply staleness on uncollected data.
  if (
    ageDays === null ||
    state === 'access' ||
    state === 'pending' ||
    state === 'unknown'
  ) {
    return (
      <span
        title={cadence}
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--vt-text-muted)]',
          className,
        )}
      >
        not observed
      </span>
    );
  }

  const remaining = windowDays - ageDays;
  const tone: 'fresh' | 'aging' | 'stale' =
    remaining <= 0 ? 'stale' : remaining / windowDays < 0.5 ? 'aging' : 'fresh';

  const toneText = {
    fresh: 'text-[var(--vt-state-verified)]',
    aging: 'text-[var(--vt-state-pending)]',
    stale: 'text-[var(--vt-state-blocked)]',
  }[tone];

  const toneBar = {
    fresh: 'bg-[var(--vt-state-verified)]',
    aging: 'bg-[var(--vt-state-pending)]',
    stale: 'bg-[var(--vt-state-blocked)]',
  }[tone];

  const pct = Math.max(2, Math.min(100, Math.round((remaining / windowDays) * 100)));

  const label =
    tone === 'stale'
      ? `stale · ${-remaining}d past`
      : `valid ${remaining}d`;

  return (
    <div
      className={cn('flex flex-col items-end gap-0.5', className)}
      title={`${cadence} · window ${windowDays}d · age ${ageDays}d`}
    >
      <span
        className={cn(
          'font-mono text-[10px] uppercase tracking-[0.12em]',
          toneText,
        )}
      >
        · {label}
      </span>
      <div className="h-[2px] w-[76px] bg-[var(--vt-border-subtle)] rounded-full overflow-hidden">
        <div
          className={cn('h-full transition-[width]', toneBar)}
          style={{ width: `${tone === 'stale' ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}
