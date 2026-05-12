'use client';

/**
 * ReplayInspectionMode.tsx
 *
 * Expandable replay chain inspection panel using <details> for semantic
 * expand/collapse (no JavaScript animation, accessible by default).
 *
 * Collapsed: single summary row — "N checks · last: {checkedAt} · {runId}"
 * Expanded: full ledger view with chain links and tier badges
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

function truncateId(id: string, len = 8): string {
  if (id.length <= len) return id;
  return id.slice(0, len);
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
      className="border border-gray-200 rounded overflow-hidden"
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
        {/* Ledger header */}
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 py-1.5 bg-gray-50 border-b border-gray-100">
          {['Run ID', 'Checked At', 'Source', 'Tier'].map((col) => (
            <span
              key={col}
              className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400"
            >
              {col}
            </span>
          ))}
        </div>

        {/* Ledger rows */}
        {runs.map((run, i) => (
          <div
            key={run.runId}
            className="vcv-row grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 min-h-[36px] items-center"
          >
            {/* Run ID + chain link */}
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-mono text-gray-800 truncate">
                {run.runId}
              </span>
              {run.priorRunId ? (
                <span className="vcv-chain-link text-[10px] truncate">
                  {truncateId(run.priorRunId)}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-gray-300 pl-4">
                  ↳ genesis
                </span>
              )}
            </div>

            {/* Checked At */}
            <span className="text-xs font-mono text-gray-600 tabular-nums whitespace-nowrap">
              {run.checkedAt}
            </span>

            {/* Source */}
            <span className="text-xs text-gray-600 truncate max-w-[120px]">
              {run.source}
            </span>

            {/* Tier badge */}
            <div className="flex justify-end">
              <TrustTierBadge tier={run.tier} />
            </div>
          </div>
        ))}

        {runs.length === 0 && (
          <div className="px-3 py-3 text-xs text-gray-400 font-mono">
            No replay runs recorded.
          </div>
        )}
      </div>
    </details>
  );
}
