'use client';

/**
 * ReplayChainExplorer.tsx
 *
 * Visual linked list of replay runs. Horizontal scroll on desktop,
 * vertical fallback on mobile. Full detail below the chain.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayChainExplorerProps {
  runs: Array<{
    runId: string;
    checkedAt: string;
    laneId: string;
    source: string;
    status: string;
    tier: 'T1' | 'T2' | 'T3' | 'T4';
    priorRunId: string | null;
    signerKid: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function statusCls(s: string): string {
  switch (s) {
    case 'verified':     return 'text-green-700';
    case 'unavailable':  return 'text-gray-400';
    case 'stale':        return 'text-amber-600';
    case 'not_checked':  return 'text-gray-400';
    case 'adverse':      return 'text-red-600';
    default:             return 'text-gray-600';
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReplayChainExplorer({ runs }: ReplayChainExplorerProps) {
  if (runs.length === 0) {
    return (
      <div className="border border-gray-200 bg-white">
        <div className="vcv-anchor-band">
          <span className="vcv-label">Replay Chain Explorer</span>
        </div>
        <div className="px-4 py-3 text-xs text-gray-400 italic">No replay chain recorded.</div>
      </div>
    );
  }

  // Most recent first in chain display
  const sorted = [...runs].sort(
    (a, b) => new Date(b.checkedAt).getTime() - new Date(a.checkedAt).getTime(),
  );

  return (
    <div className="border border-gray-200 bg-white">
      <div className="vcv-anchor-band">
        <span className="vcv-label">Replay Chain Explorer</span>
      </div>

      {/* Chain — horizontal scroll, vertical on small screens */}
      <div className="px-4 py-3 border-b border-gray-100">
        {/* Horizontal (md+) */}
        <div className="hidden md:flex items-center overflow-x-auto pb-2">
          {sorted.map((run, idx) => {
            const isActive = idx === 0;
            return (
              <div key={run.runId} className="flex items-center">
                <div
                  className={[
                    'font-mono text-xs border px-2 py-1 shrink-0',
                    isActive
                      ? 'border-gray-900 text-gray-900 font-semibold'
                      : 'border-gray-200 text-gray-500',
                  ].join(' ')}
                >
                  <div>[{run.runId}]</div>
                  <div className={`text-[10px] ${statusCls(run.status)}`}>
                    {run.tier} · {statusLabel(run.status)}
                  </div>
                  <div className="text-[9px] text-gray-400 mt-0.5">
                    {run.checkedAt.slice(0, 10)}
                  </div>
                </div>
                {idx < sorted.length - 1 && (
                  <span className="text-gray-300 mx-2 font-mono text-xs">→</span>
                )}
                {idx === sorted.length - 1 && run.priorRunId === null && (
                  <>
                    <span className="text-gray-300 mx-2 font-mono text-xs">→</span>
                    <span className="font-mono text-[10px] text-gray-400">genesis</span>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Vertical (mobile) */}
        <div className="md:hidden flex flex-col gap-2">
          {sorted.map((run, idx) => {
            const isActive = idx === 0;
            return (
              <div key={run.runId} className="flex items-start gap-2">
                {idx < sorted.length - 1 || run.priorRunId === null ? (
                  <div className="flex flex-col items-center">
                    <div className={`font-mono text-xs border px-2 py-1 ${isActive ? 'border-gray-900 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                      [{run.runId}]
                    </div>
                    <span className="text-gray-300 font-mono text-xs mt-1">↓</span>
                  </div>
                ) : (
                  <div className={`font-mono text-xs border px-2 py-1 ${isActive ? 'border-gray-900 font-semibold' : 'border-gray-200 text-gray-500'}`}>
                    [{run.runId}]
                  </div>
                )}
                <div className="mt-0.5">
                  <div className={`text-[10px] font-mono ${statusCls(run.status)}`}>
                    {run.tier} · {statusLabel(run.status)}
                  </div>
                  <div className="text-[9px] font-mono text-gray-400">
                    {run.checkedAt.slice(0, 10)}
                  </div>
                </div>
              </div>
            );
          })}
          {sorted[sorted.length - 1]?.priorRunId === null && (
            <span className="font-mono text-[10px] text-gray-400 ml-1">genesis</span>
          )}
        </div>
      </div>

      {/* Detail rows */}
      <div>
        {sorted.map((run) => (
          <div key={`detail-${run.runId}`} className="px-4 py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-mono text-xs text-gray-900 font-semibold">[{run.runId}]</span>
              <span className="font-mono text-xs text-gray-500">{run.checkedAt}</span>
              <span className="font-mono text-xs text-gray-600">{run.laneId}</span>
              <span className={`font-mono text-xs font-semibold ${statusCls(run.status)}`}>
                {statusLabel(run.status)}
              </span>
              <span className="font-mono text-[10px] border border-gray-300 px-1 text-gray-500">
                {run.tier}
              </span>
            </div>
            <div className="mt-0.5 text-[10px] text-gray-400 flex flex-wrap gap-2">
              <span>Source: {run.source}</span>
              {run.priorRunId && (
                <>
                  <span>·</span>
                  <span>Prior: <span className="font-mono">{run.priorRunId}</span></span>
                </>
              )}
              {run.signerKid && (
                <>
                  <span>·</span>
                  <span>Key: <span className="font-mono">{run.signerKid.slice(0, 20)}…</span></span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
