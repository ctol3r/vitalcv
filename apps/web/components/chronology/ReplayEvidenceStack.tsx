'use client';

/**
 * ReplayEvidenceStack.tsx
 *
 * Compact connected ledger of replay run blocks.
 * Each run shares a border with the next — no rounded corners, no gaps.
 * Footer summarises the evidence chain.
 */

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayEvidenceStackProps {
  runs: Array<{
    runId: string;
    checkedAt: string;
    source: string;
    status: string;
    tier: 'T1' | 'T2' | 'T3' | 'T4';
    receiptId: string | null;
    priorRunId: string | null;
  }>;
  survivabilityScore: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTextCls(s: string): string {
  switch (s) {
    case 'verified':    return 'text-green-700';
    case 'stale':       return 'text-amber-600';
    case 'unavailable': return 'text-gray-400';
    case 'adverse':     return 'text-red-600';
    default:            return 'text-gray-400';
  }
}

function statusLabel(s: string): string {
  return s.toUpperCase().replace(/_/g, ' ');
}

function scoreColorCls(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-600';
}

function countGaps(runs: ReplayEvidenceStackProps['runs']): number {
  // A gap: priorRunId present but no matching run in the stack
  const ids = new Set(runs.map((r) => r.runId));
  return runs.filter((r) => r.priorRunId && !ids.has(r.priorRunId)).length;
}

function countSigners(runs: ReplayEvidenceStackProps['runs']): number {
  // Runs don't carry signerKid here — return 1 if any exist
  return runs.length > 0 ? 1 : 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReplayEvidenceStack({ runs, survivabilityScore }: ReplayEvidenceStackProps) {
  const gapCount = countGaps(runs);
  const signerCount = countSigners(runs);

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Replay Evidence Stack
        </div>
        <div className="text-[10px] font-mono text-gray-400">
          Survivability:{' '}
          <span className={cn('font-semibold', scoreColorCls(survivabilityScore))}>
            {survivabilityScore}/100
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 mb-0" />

      {/* Run blocks — connected ledger */}
      {runs.length === 0 ? (
        <div className="border border-gray-200 px-3 py-2">
          <span className="text-xs font-mono text-gray-400">No runs.</span>
        </div>
      ) : (
        <div>
          {runs.map((run, idx) => {
            const isLast = idx === runs.length - 1;
            return (
              <div
                key={run.runId}
                className={cn(
                  'border-l border-r border-t border-gray-200 px-3 py-2 min-h-[32px]',
                  isLast && 'border-b'
                )}
              >
                {/* Run header line */}
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-mono text-xs font-semibold text-gray-900 uppercase">
                    RUN {run.runId.slice(0, 8)}
                  </span>
                  <span className="text-[10px] font-mono border border-gray-200 px-1.5 py-0.5 text-gray-500">
                    {run.tier}
                  </span>
                  <span className={cn('text-[10px] font-semibold uppercase tracking-wide', statusTextCls(run.status))}>
                    {statusLabel(run.status)}
                  </span>
                  <span className="font-mono text-[10px] text-gray-400">{run.checkedAt}</span>
                </div>

                {/* Meta line */}
                <div className="mt-0.5 font-mono text-[10px] text-gray-400 flex flex-wrap gap-x-2">
                  <span>Source: {run.source}</span>
                  {run.receiptId && (
                    <span>· Receipt: {run.receiptId.slice(0, 12)}{run.receiptId.length > 12 ? '…' : ''}</span>
                  )}
                </div>

                {/* Chain link */}
                <div className="mt-0.5 text-[9px] font-mono text-gray-300">
                  {run.priorRunId
                    ? `↳ continues run ${run.priorRunId.slice(0, 8)}`
                    : '↳ genesis'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer summary */}
      <div className="border-t border-gray-200 pt-1 mt-0">
        <div className="text-[10px] font-mono text-gray-400">
          Evidence chain: {runs.length} run{runs.length !== 1 ? 's' : ''} · {gapCount} gap{gapCount !== 1 ? 's' : ''} · {signerCount} signer{signerCount !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  );
}
