'use client';

/**
 * ReplaySurvivabilityMasthead.tsx
 *
 * Dark horizontal masthead band showing replay survivability summary.
 * NOT a full-page dark bg — just a horizontal bar.
 * Used at the top of investigation surfaces below the page masthead.
 */

import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplaySurvivabilityMastheadProps {
  survivabilityScore: number;   // 0-100
  runCount: number;
  signerCount: number;
  gapCount: number;
  latestCheckedAt: string;
  latestRunId: string;
  issuerDid: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColorCls(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-red-400';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ReplaySurvivabilityMasthead({
  survivabilityScore,
  runCount,
  signerCount,
  gapCount,
  latestCheckedAt,
  latestRunId,
  issuerDid,
}: ReplaySurvivabilityMastheadProps) {
  return (
    <div className="bg-gray-900 text-white px-4 py-3">
      {/* Label */}
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
        Replay Survivability
      </div>

      {/* Score + metrics */}
      <div className="mt-0.5 font-mono text-xs text-gray-400 flex flex-wrap gap-x-3">
        <span>
          Score:{' '}
          <span className={cn('font-semibold text-sm', scoreColorCls(survivabilityScore))}>
            {survivabilityScore}/100
          </span>
        </span>
        <span>Runs: {runCount}</span>
        <span>Signers: {signerCount}</span>
        <span>Gaps: {gapCount}</span>
      </div>

      {/* Latest run */}
      <div className="mt-0.5 font-mono text-xs text-gray-300">
        Latest:{' '}
        <span className="text-gray-200">{latestRunId.slice(0, 8)}</span>
        {'  '}
        <span className="text-gray-400">{latestCheckedAt}</span>
      </div>

      {/* Issuer DID */}
      <div className="mt-0.5 font-mono text-xs text-gray-400">{issuerDid}</div>
    </div>
  );
}
