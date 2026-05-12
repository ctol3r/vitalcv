'use client';

/**
 * ReplayInspectionMode.tsx
 *
 * Expandable replay chain inspection panel using <details> for semantic
 * expand/collapse. Connected ledger run blocks with gap banners.
 *
 * Collapsed: single summary row — "N checks · last: {checkedAt} · {runId}"
 * Expanded: connected ledger view with chain links, tier badges, gap banners
 *
 * wave-receipt-elevation: connected border ledger, gap banners, audit packet style.
 */

import { TrustTierBadge, type TrustTier } from '@/components/proof/TrustTierBadge';

export interface ReplayInspectionModeProps {
  runs: Array<{
    runId: string;
    checkedAt: string;
    source: string;
    status: string;
    tier: TrustTier;
    priorRunId: string | null;
  }>;
  defaultExpanded?: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  verified: 'VERIFIED',
  in_progress: 'IN PROGRESS',
  not_checked: 'NOT CHECKED',
  stale: 'STALE',
  unavailable: 'UNAVAILABLE',
  access_required: 'ACCESS REQ.',
  review_required: 'REVIEW REQ.',
  adverse: 'ADVERSE',
  signed: 'SIGNED',
};

const STATUS_TEXT: Record<string, string> = {
  verified: 'text-green-700 font-semibold',
  signed: 'text-green-700 font-semibold',
  adverse: 'text-red-700 font-semibold',
  stale: 'text-amber-700 font-semibold',
  in_progress: 'text-blue-700 font-semibold',
  not_checked: 'text-gray-500',
  unavailable: 'text-gray-500',
  access_required: 'text-amber-700 font-semibold',
  review_required: 'text-amber-700 font-semibold',
};

function truncateId(id: string, len = 8): string {
  if (id.length <= len) return id;
  return id.slice(0, len);
}

/** Detect notable gap between two ISO timestamps (> 7 days) */
function hasGap(a: string, b: string): boolean {
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return diff > 7 * 24 * 60 * 60 * 1000;
}

function gapDays(a: string, b: string): number {
  const diff = Math.abs(new Date(a).getTime() - new Date(b).getTime());
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

export function ReplayInspectionMode({
  runs,
  defaultExpanded = false,
}: ReplayInspectionModeProps) {
  const count = runs.length;
  const last = runs[0]; // most recent first

  return (
    <details
      open={defaultExpanded}
      className="border border-gray-200 rounded-none overflow-hidden"
    >
      {/* Collapsed summary */}
      <summary className="flex items-center justify-between px-3 min-h-[36px] cursor-pointer list-none select-none hover:bg-gray-50 transition-colors group">
        <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-900 transition-colors">
          {count} check{count !== 1 ? 's' : ''} · last:{' '}
          {last?.checkedAt ?? '—'} ·{' '}
          <span className="text-gray-400">{last?.runId ? truncateId(last.runId) : '—'}</span>
        </span>
        <span className="text-[10px] font-mono text-gray-400 group-hover:text-gray-700 transition-colors ml-3 flex-shrink-0">
          ↓ Inspect
        </span>
      </summary>

      {/* Expanded ledger */}
      <div className="border-t border-gray-200">
        {/* Ledger header — Bloomberg style */}
        <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
            Run Ledger
          </span>
        </div>

        {/* Connected run blocks */}
        {runs.length === 0 ? (
          <div className="px-3 py-3 text-xs text-gray-400 font-mono">
            No replay runs recorded.
          </div>
        ) : (
          <div>
            {runs.map((run, i) => {
              const isLast = i === runs.length - 1;
              const nextRun = runs[i + 1];
              const showGap =
                !isLast &&
                nextRun &&
                hasGap(run.checkedAt, nextRun.checkedAt);
              const statusCls = STATUS_TEXT[run.status] ?? 'text-gray-600 font-semibold';

              return (
                <div key={run.runId}>
                  {/* Run block */}
                  <div
                    className={[
                      'border border-gray-200 p-3',
                      !isLast && !showGap ? 'border-b-0' : '',
                      i === 0 ? 'border-t-0' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    {/* Line 1: run_id + tier badge */}
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div>
                        <span className="text-[10px] text-gray-400">run_id: </span>
                        <span className="font-mono text-sm text-gray-900">
                          {truncateId(run.runId)}
                        </span>
                      </div>
                      <TrustTierBadge tier={run.tier} />
                    </div>

                    {/* Line 2: timestamp */}
                    <div className="font-mono text-xs text-gray-500 mb-0.5">
                      {run.checkedAt}
                    </div>

                    {/* Line 3: source + status */}
                    <div className="text-xs text-gray-600">
                      Source:{' '}
                      <span className="font-medium">{run.source}</span>
                      {' · '}
                      Status:{' '}
                      <span className={statusCls}>
                        {STATUS_LABEL[run.status] ?? run.status.toUpperCase()}
                      </span>
                    </div>

                    {/* Line 4: chain link */}
                    {run.priorRunId ? (
                      <div className="font-mono text-xs text-gray-400 mt-0.5 ml-2">
                        ↳ prior: {truncateId(run.priorRunId)}
                      </div>
                    ) : (
                      <div className="font-mono text-xs text-gray-300 mt-0.5 ml-2">
                        ↳ genesis
                      </div>
                    )}
                  </div>

                  {/* Gap banner */}
                  {showGap && nextRun && (
                    <div className="border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 font-mono">
                      ⚠ Gap detected — {gapDays(run.checkedAt, nextRun.checkedAt)}d between runs
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
