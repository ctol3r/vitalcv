import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckedAtStamp } from './CheckedAtStamp';
import { RunIdentity } from './RunIdentity';

/**
 * ReplayLineage — canonical replay continuity primitive.
 *
 * The Lane A audit found that lineage exists in `ReviewClient.tsx:554` as
 * plain text and in the `X-VitalCV-Replay-Attribution` export-packet
 * header but is otherwise hidden. This primitive renders lineage as an
 * **evidence continuity chain**, not an analytics-style metric strip:
 * each prior check is a node, gaps are explicit, and the user reads
 * left-to-right "this is the same subject across these runs."
 */

export interface ReplayLineagePriorCheck {
  /** Run id that produced this check. */
  runId: string;
  /** ISO timestamp the check was performed. */
  checkedAt: string;
  /** Optional source id. */
  sourceId?: string;
}

export interface ReplayLineageGap {
  /** ISO timestamp the prior check ended. */
  from: string;
  /** ISO timestamp the next check began. */
  to: string;
  /** Reason the gap exists (e.g. 'source unreachable', 'no scheduled run'). */
  reason: string;
}

export interface ReplayLineageProps {
  /** Stable lineage key — same value across all runs that pertain to one entity. */
  lineageKey: string;
  /** Prior checks in chronological order (oldest first). */
  priorChecks: readonly ReplayLineagePriorCheck[];
  /** Continuity gaps (from→to windows where no check happened). */
  gaps?: readonly ReplayLineageGap[];
  /** Current replay count (number of times this lineage has been re-verified). */
  replayCount?: number;
  className?: string;
}

function isContinuous(
  checks: readonly ReplayLineagePriorCheck[],
  gaps: readonly ReplayLineageGap[],
): boolean {
  return checks.length > 0 && gaps.length === 0;
}

export function ReplayLineage({
  lineageKey,
  priorChecks,
  gaps = [],
  replayCount,
  className,
}: ReplayLineageProps): React.ReactElement {
  const continuous = isContinuous(priorChecks, gaps);
  const sortedChecks = [...priorChecks].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));
  const sortedGaps = [...gaps].sort((a, b) => a.from.localeCompare(b.from));

  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-lg border px-3 py-2',
        continuous
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-amber-500/40 bg-amber-500/5',
        className,
      )}
      data-replay-continuous={continuous ? 'true' : 'false'}
      data-replay-lineage-key={lineageKey}
      aria-label="Replay lineage"
    >
      <header className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="font-mono uppercase tracking-wide text-muted-foreground">lineage</span>
          <span className="font-mono text-foreground" title={lineageKey}>
            {lineageKey}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <span className="font-mono uppercase tracking-wider opacity-70">
            replays {typeof replayCount === 'number' ? replayCount : sortedChecks.length}
          </span>
          <span
            className={cn(
              'font-mono uppercase tracking-wider',
              continuous ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300',
            )}
          >
            {continuous ? 'continuous' : `${sortedGaps.length} gap${sortedGaps.length === 1 ? '' : 's'}`}
          </span>
        </div>
      </header>

      {sortedChecks.length === 0 && (
        <p className="text-[11px] italic opacity-80">
          No prior checks recorded for this lineage.
        </p>
      )}

      {sortedChecks.length > 0 && (
        <ol className="flex flex-col gap-1" role="list">
          {sortedChecks.map((check, i) => (
            <li
              key={`${check.runId}-${i}`}
              className="flex items-center gap-2 text-[11px]"
              data-prior-check-index={i}
            >
              <span
                aria-hidden="true"
                className="font-mono text-muted-foreground"
              >
                {i === 0 ? '┌' : i === sortedChecks.length - 1 ? '└' : '├'}
              </span>
              <RunIdentity runId={check.runId} label="run" className="text-[10px]" />
              <CheckedAtStamp checkedAt={check.checkedAt} label="at" format="long" className="text-[10px]" />
              {check.sourceId && (
                <span className="font-mono text-[10px] uppercase opacity-70">
                  · {check.sourceId}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}

      {sortedGaps.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-amber-500/20 pt-1" role="list">
          {sortedGaps.map((gap, i) => (
            <li
              key={`gap-${i}`}
              className="text-[11px] text-amber-800 dark:text-amber-200"
              data-replay-gap-index={i}
            >
              <span className="font-mono uppercase tracking-wider opacity-80">gap </span>
              <time className="font-mono" dateTime={gap.from}>{gap.from}</time>
              <span className="opacity-60"> → </span>
              <time className="font-mono" dateTime={gap.to}>{gap.to}</time>
              <span className="opacity-70"> · {gap.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
