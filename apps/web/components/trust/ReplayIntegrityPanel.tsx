'use client';
import * as React from 'react';
import { cn } from '@/lib/utils';
import { CheckedAtStamp } from './CheckedAtStamp';
import { RunIdentity } from './RunIdentity';
import {
  evaluateReplayCoherence,
  summarizeReplayGaps,
  type CoherenceFinding,
  type GapInput,
  type GapSummary,
} from '@/lib/replay/integrityEvaluation';

/**
 * ReplayIntegrityPanel — single operator-visible surface that turns
 * the canonical replay-identity contract into something a reviewer
 * reads in <30 seconds. Renders three rows in the institutional
 * register (mono identifiers, left-aligned, no shadows, no
 * decorative elements):
 *
 *   row 1 — coherence: does the runId the backend declared match
 *           the runId locally recomputed from the same evidence?
 *           OK / lineage-drift / run-drift / no-declaration.
 *
 *   row 2 — gap summary over the provided history (typically the
 *           recent-NPIs list maintained by `useRecentNpis`). Renders
 *           "continuous" or "N gap(s), largest 12d" with explicit
 *           timestamps for the largest gap.
 *
 *   row 3 — scheme version + active lineage/run identifiers, always
 *           visible (not in a tooltip, not aria-only).
 *
 * Visual rule: monochrome with coloured borders ONLY on coherence
 * states (emerald = ok, amber = run-drift, rose = lineage-drift).
 * No charts, no animations, no decorative iconography.
 */

export interface ReplayIntegrityPanelProps {
  /** Inputs identical to the backend's replay-identity contract. */
  evidence: {
    entityId: string;
    lastCheckedAt: string | null;
    artifactChecksums?: readonly string[];
    channel?: string | null;
  };
  /** What the backend declared on the passport response, if anything. */
  declared?: { lineageKey?: string; runId?: string; schemeVersion?: 'v1' } | null;
  /** Optional history list for the gap row (newest-first OK; sorted inside). */
  history?: readonly GapInput[];
  /** Gap threshold in hours (default 720 / 30 days, matching the script default). */
  gapThresholdHours?: number;
  className?: string;
}

export function ReplayIntegrityPanel({
  evidence,
  declared,
  history = [],
  gapThresholdHours = 720,
  className,
}: ReplayIntegrityPanelProps): React.ReactElement {
  const [coherence, setCoherence] = React.useState<CoherenceFinding | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const finding = await evaluateReplayCoherence({
        entityId: evidence.entityId,
        lastCheckedAt: evidence.lastCheckedAt,
        artifactChecksums: evidence.artifactChecksums,
        channel: evidence.channel,
        declared,
      });
      if (!cancelled) setCoherence(finding);
    })();
    return () => { cancelled = true; };
  }, [evidence.entityId, evidence.lastCheckedAt, evidence.channel, evidence.artifactChecksums, declared]);

  const gapSummary: GapSummary = summarizeReplayGaps(history, gapThresholdHours);

  return (
    <section
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-border px-3 py-2',
        className,
      )}
      data-replay-integrity-panel="true"
      aria-label="Replay integrity"
    >
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          replay integrity
        </span>
        <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">
          scheme · {declared?.schemeVersion ?? coherence?.state === 'coherent' ? 'v1' : 'pending'}
        </span>
      </header>

      <CoherenceRow finding={coherence} />
      <GapsRow summary={gapSummary} thresholdHours={gapThresholdHours} />
      <IdentityRow finding={coherence} />
    </section>
  );
}

// ── Internal rows ──────────────────────────────────────────────────────────

function CoherenceRow({ finding }: { finding: CoherenceFinding | null }): React.ReactElement {
  if (finding === null) {
    return (
      <div
        className="flex items-baseline gap-2 text-[11px] opacity-60"
        data-replay-coherence="computing"
      >
        <span className="font-mono uppercase tracking-wide">coherence</span>
        <span className="italic">computing…</span>
      </div>
    );
  }

  if (finding.state === 'no-declaration') {
    return (
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] border-l-2 border-dashed border-zinc-400/40 pl-2"
        data-replay-coherence="no-declaration"
      >
        <span className="font-mono uppercase tracking-wide text-muted-foreground">coherence</span>
        <span className="opacity-80">declared replay identity unavailable</span>
        <span className="font-mono opacity-70" title={finding.expectedRunId}>
          expected runId: {finding.expectedRunId}
        </span>
      </div>
    );
  }

  if (finding.state === 'coherent') {
    return (
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] border-l-2 border-emerald-500/50 pl-2 text-emerald-800 dark:text-emerald-200"
        data-replay-coherence="coherent"
      >
        <span className="font-mono uppercase tracking-wide">coherence</span>
        <span>declared identity matches recomputed identity</span>
      </div>
    );
  }

  if (finding.state === 'run-drift') {
    return (
      <div
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] border-l-2 border-amber-500/50 pl-2 text-amber-800 dark:text-amber-200"
        data-replay-coherence="run-drift"
        role="status"
      >
        <span className="font-mono uppercase tracking-wide">coherence</span>
        <span>run id drift — same subject, different snapshot evidence</span>
        <span className="font-mono opacity-80" title={finding.expectedRunId}>
          expected: {finding.expectedRunId}
        </span>
        <span className="font-mono opacity-80" title={finding.declaredRunId}>
          declared: {finding.declaredRunId}
        </span>
      </div>
    );
  }

  // lineage-drift — different subject; surface as alert
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] border-l-2 border-rose-500/50 pl-2 text-rose-800 dark:text-rose-200"
      data-replay-coherence="lineage-drift"
      role="alert"
    >
      <span className="font-mono uppercase tracking-wide">coherence</span>
      <span>lineage drift — declared identity does not match this subject</span>
      <span className="font-mono opacity-80" title={finding.expectedLineageKey}>
        expected lineage: {finding.expectedLineageKey}
      </span>
      <span className="font-mono opacity-80" title={finding.declaredLineageKey}>
        declared lineage: {finding.declaredLineageKey}
      </span>
    </div>
  );
}

function GapsRow({
  summary,
  thresholdHours,
}: {
  summary: GapSummary;
  thresholdHours: number;
}): React.ReactElement {
  if (summary.snapshotCount === 0) {
    return (
      <div
        className="flex items-baseline gap-2 text-[11px] opacity-70"
        data-replay-gaps="no-history"
      >
        <span className="font-mono uppercase tracking-wide text-muted-foreground">gaps</span>
        <span className="italic">no prior inspection history</span>
      </div>
    );
  }
  if (summary.continuous) {
    return (
      <div
        className="flex items-baseline gap-2 text-[11px] border-l-2 border-emerald-500/50 pl-2 text-emerald-800 dark:text-emerald-200"
        data-replay-gaps="continuous"
        data-snapshot-count={summary.snapshotCount}
      >
        <span className="font-mono uppercase tracking-wide">gaps</span>
        <span>
          continuous over {summary.snapshotCount} snapshot{summary.snapshotCount === 1 ? '' : 's'} (threshold {thresholdHours}h)
        </span>
      </div>
    );
  }
  const largest = summary.largestGap;
  return (
    <div
      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] border-l-2 border-amber-500/50 pl-2 text-amber-800 dark:text-amber-200"
      data-replay-gaps="discontinuous"
      data-gap-count={summary.gapCount}
      role="status"
    >
      <span className="font-mono uppercase tracking-wide">gaps</span>
      <span>
        {summary.gapCount} gap{summary.gapCount === 1 ? '' : 's'} detected above {thresholdHours}h
      </span>
      {largest && (
        <>
          <span className="font-mono opacity-80">
            largest {largest.hours}h
          </span>
          <CheckedAtStamp checkedAt={largest.from} label="from" format="long" className="text-[10px]" />
          <CheckedAtStamp checkedAt={largest.to} label="to" format="long" className="text-[10px]" />
        </>
      )}
    </div>
  );
}

function IdentityRow({ finding }: { finding: CoherenceFinding | null }): React.ReactElement {
  if (finding === null) {
    return (
      <div className="flex items-baseline gap-2 text-[11px] opacity-60" data-replay-identity="computing">
        <span className="font-mono uppercase tracking-wide">identity</span>
        <span className="italic">computing…</span>
      </div>
    );
  }

  const lineageKey =
    finding.state === 'lineage-drift' ? finding.expectedLineageKey
    : finding.state === 'no-declaration' ? finding.expectedLineageKey
    : finding.lineageKey;
  const runId =
    finding.state === 'lineage-drift' ? finding.expectedRunId
    : finding.state === 'no-declaration' ? finding.expectedRunId
    : finding.state === 'coherent' ? finding.runId
    : finding.expectedRunId;

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] opacity-90" data-replay-identity="resolved">
      <span className="font-mono uppercase tracking-wide text-muted-foreground">identity</span>
      <span className="font-mono opacity-80" title={lineageKey} data-lineage-key={lineageKey}>
        lineage · {lineageKey}
      </span>
      <RunIdentity runId={runId} label="run" displayChars={14} className="text-[10px]" />
    </div>
  );
}
