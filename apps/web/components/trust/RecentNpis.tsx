import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { CheckedAtStamp } from './CheckedAtStamp';
import { RunIdentity } from './RunIdentity';
import type { RecentNpiEntry } from '@/lib/hooks/useRecentNpis';

/**
 * RecentNpis — institutional replay-chain rendering of NPIs inspected
 * on this client. Reads as an audit log, not as a card grid: monospace
 * identifiers, left-aligned, no shadows, no decoration. Replay
 * indicator is explicit text (`replayed Nx`) when an NPI has been
 * re-touched, so a verifier reads "this subject has been inspected
 * multiple times in this session" without inspecting devtools.
 *
 * Composition (reuses Lane B primitives — no new visual vocabulary):
 *  - <CheckedAtStamp>     per row's `lastCheckedAt`
 *  - <RunIdentity>        per row's `runId`
 *
 * Empty state renders an explicit "No recent inspections" line — never
 * a placeholder card or skeleton, since absence-of-history is a real
 * institutional signal (this is a fresh client / cleared cache) and
 * should read as such.
 */
export interface RecentNpisProps {
  items: readonly RecentNpiEntry[];
  /** Highlight a particular NPI (e.g. the one the surface currently shows). */
  currentNpi?: string;
  /** Optional header label. Defaults to "recent inspections". */
  label?: string;
  /** Max items to render. Defaults to 10 (= storage cap). */
  max?: number;
  className?: string;
}

export function RecentNpis({
  items,
  currentNpi,
  label = 'recent inspections',
  max = 10,
  className,
}: RecentNpisProps): React.ReactElement {
  const shown = items.slice(0, max);
  return (
    <section
      className={cn(
        'flex flex-col gap-2 border-t border-border pt-3',
        className,
      )}
      data-recent-npis-count={shown.length}
      aria-label="Recent NPI inspections"
    >
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">
          {shown.length} / {max}
        </span>
      </header>

      {shown.length === 0 && (
        <p className="text-[11px] italic opacity-70">
          No recent inspections on this client.
        </p>
      )}

      {shown.length > 0 && (
        <ol className="flex flex-col" role="list">
          {shown.map((entry, i) => {
            const isCurrent = currentNpi === entry.npi;
            const replayed = entry.replayCount > 1;
            return (
              <li
                key={entry.npi}
                className={cn(
                  'flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 text-[11px]',
                  i > 0 && 'border-t border-border/40',
                  isCurrent && 'bg-foreground/[0.02] -mx-2 px-2',
                )}
                data-npi={entry.npi}
                data-replay-count={entry.replayCount}
                data-current={isCurrent ? 'true' : 'false'}
              >
                <span
                  aria-hidden="true"
                  className="font-mono text-muted-foreground"
                >
                  {i === 0 ? '┌' : i === shown.length - 1 ? '└' : '├'}
                </span>
                <Link
                  href={`/passport/${entry.npi}`}
                  className="font-mono text-foreground hover:underline"
                  prefetch={false}
                >
                  {entry.npi}
                </Link>
                {entry.displayName && (
                  <span className="opacity-80">{entry.displayName}</span>
                )}
                {replayed && (
                  <span
                    className="font-mono uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-300"
                    title="previously checked on this client"
                  >
                    replayed {entry.replayCount}x
                  </span>
                )}
                {isCurrent && (
                  <span className="font-mono uppercase tracking-wider text-[10px] text-emerald-700 dark:text-emerald-300">
                    current
                  </span>
                )}
                {entry.lastCheckedAt && (
                  <CheckedAtStamp
                    checkedAt={entry.lastCheckedAt}
                    label="checked"
                    format="long"
                    className="text-[10px]"
                  />
                )}
                {entry.runId && (
                  <RunIdentity
                    runId={entry.runId}
                    label="run"
                    displayChars={10}
                    className="text-[10px]"
                  />
                )}
                <CheckedAtStamp
                  checkedAt={entry.viewedAt}
                  label="viewed"
                  format="long"
                  className="text-[10px] ml-auto opacity-70"
                />
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
