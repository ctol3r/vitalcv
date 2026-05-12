'use client';

/**
 * ReplayChronology.tsx
 *
 * Evidence chronology display — reads like a legal ledger, not analytics.
 * Chain links, gap banners, signer evolution, survivability score.
 */

import { TrustTierBadge } from '@/components/proof/TrustTierBadge';
import type { TrustTier } from '@/components/proof/TrustTierBadge';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ReplayRun {
  runId: string;
  checkedAt: string;       // ISO "YYYY-MM-DD HH:mm:ss UTC"
  laneId: string;
  source: string;
  status: string;          // "verified" | "unavailable" | "stale" | etc.
  tier: TrustTier;
  receiptId: string | null;
  priorRunId: string | null;
  signerKid: string | null;
}

export interface ContinuityGap {
  afterRunId: string | null;
  gapType: 'stale_run' | 'signer_rotation' | 'missing_lane' | 'actor_mismatch';
  description: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface ReplayChronologyProps {
  runs: ReplayRun[];
  gaps?: ContinuityGap[];
  survivabilityScore?: number;
  compact?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  verified: 'VERIFIED',
  unavailable: 'UNAVAILABLE',
  stale: 'STALE',
  not_checked: 'NOT CHECKED',
  in_progress: 'IN PROGRESS',
  access_required: 'ACCESS REQUIRED',
  review_required: 'REVIEW REQUIRED',
  adverse: 'ADVERSE',
};

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.toUpperCase().replace(/_/g, ' ');
}

function statusColor(status: string): string {
  switch (status) {
    case 'verified':
      return 'text-green-700';
    case 'unavailable':
    case 'adverse':
      return 'text-red-700';
    case 'stale':
      return 'text-amber-700';
    case 'in_progress':
      return 'text-blue-700';
    default:
      return 'text-gray-500';
  }
}

function gapSeverityStyles(severity: ContinuityGap['severity']): {
  border: string;
  label: string;
  text: string;
} {
  switch (severity) {
    case 'critical':
      return {
        border: 'border-red-400',
        label: 'CRITICAL',
        text: 'text-red-700',
      };
    case 'warning':
      return {
        border: 'border-amber-400',
        label: 'WARNING',
        text: 'text-amber-700',
      };
    default:
      return {
        border: 'border-blue-300',
        label: 'INFO',
        text: 'text-blue-700',
      };
  }
}

function gapTypeLabel(gapType: ContinuityGap['gapType']): string {
  const labels: Record<ContinuityGap['gapType'], string> = {
    stale_run: 'stale_run',
    signer_rotation: 'signer_rotation',
    missing_lane: 'missing_lane',
    actor_mismatch: 'actor_mismatch',
  };
  return labels[gapType];
}

function survivabilityColor(score: number): string {
  if (score >= 80) return 'text-green-700';
  if (score >= 50) return 'text-amber-700';
  return 'text-red-700';
}

function countSigners(runs: ReplayRun[]): number {
  return new Set(runs.map((r) => r.signerKid ?? '__unsigned__')).size;
}

// ─── Run Block ────────────────────────────────────────────────────────────────

function RunBlock({ run, isLast }: { run: ReplayRun; isLast: boolean }) {
  const isGenesis = !run.priorRunId;

  return (
    <div className={cn('py-4 px-0', !isLast && 'border-b border-gray-200')}>
      {/* Header row */}
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="font-mono text-xs text-gray-900 font-semibold">
          [run_id: {run.runId.slice(0, 8)}]
        </span>
        <span className="text-xs text-gray-500">{run.checkedAt}</span>
        <TrustTierBadge tier={run.tier} />
      </div>

      {/* Source */}
      <div className="mt-1 text-xs text-gray-500">
        <span className="text-gray-400">Source:</span>{' '}
        <span className="text-gray-700">{run.source}</span>
      </div>

      {/* Status + Receipt + Key */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
        <span>
          <span className="text-gray-400">Status:</span>{' '}
          <span className={cn('font-semibold', statusColor(run.status))}>
            {statusLabel(run.status)}
          </span>
        </span>
        <span>
          <span className="text-gray-400">Receipt:</span>{' '}
          {run.receiptId ? (
            <span className="font-mono text-gray-700">
              {run.receiptId.slice(0, 8)}…
            </span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </span>
        {run.signerKid && (
          <span>
            <span className="text-gray-400">Key:</span>{' '}
            <span className="font-mono text-gray-700">
              {run.signerKid.slice(0, 20)}…
            </span>
          </span>
        )}
      </div>

      {/* Chain link */}
      <div className="mt-1.5 text-xs text-gray-400">
        {isGenesis ? (
          <span className="font-mono">↳ genesis</span>
        ) : (
          <span className="font-mono">
            ↳ prior:{' '}
            <span className="text-gray-600">{run.priorRunId!.slice(0, 8)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Gap Banner ───────────────────────────────────────────────────────────────

function GapBanner({ gap }: { gap: ContinuityGap }) {
  const styles = gapSeverityStyles(gap.severity);

  return (
    <div
      className={cn(
        'my-1 px-3 py-2 border border-dashed rounded text-xs',
        styles.border,
      )}
    >
      <span className="font-mono text-gray-400">── gap: {gapTypeLabel(gap.gapType)} </span>
      <span className={cn('font-bold', styles.text)}>── {styles.label} </span>
      <span className="text-gray-400">────────────────────</span>
      <div className="mt-0.5 text-gray-600 italic">"{gap.description}"</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReplayChronology({
  runs,
  gaps = [],
  survivabilityScore,
  compact = false,
}: ReplayChronologyProps) {
  if (runs.length === 0) {
    return (
      <div className="border border-gray-200 rounded px-4 py-6 text-sm text-gray-500 text-center">
        No replay history. This is a genesis run.
      </div>
    );
  }

  // Build a map of gapsByRunId: gaps that appear AFTER a given runId
  const gapsByRunId = new Map<string | null, ContinuityGap[]>();
  for (const gap of gaps) {
    const key = gap.afterRunId;
    if (!gapsByRunId.has(key)) gapsByRunId.set(key, []);
    gapsByRunId.get(key)!.push(gap);
  }

  const signerCount = countSigners(runs);
  const gapCount = gaps.length;
  const score = survivabilityScore ?? null;

  return (
    <div className="border border-gray-200 rounded overflow-hidden">
      {/* Header */}
      {!compact && (
        <div className="bg-gray-50 border-b border-gray-200 px-4 py-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Replay Chronology
          </span>
          <div className="mt-0.5 border-t border-gray-300 pt-2 font-mono text-[10px] text-gray-300 select-none">
            ─────────────────────────────────────────────────────
          </div>
        </div>
      )}

      {/* Runs with inline gaps */}
      <div className="px-4">
        {runs.map((run, idx) => {
          const afterGaps = gapsByRunId.get(run.runId) ?? [];
          const isLast = idx === runs.length - 1;
          return (
            <div key={run.runId}>
              <RunBlock run={run} isLast={isLast && afterGaps.length === 0} />
              {afterGaps.map((gap, gi) => (
                <GapBanner key={`${run.runId}-gap-${gi}`} gap={gap} />
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
        <div className="font-mono text-[10px] text-gray-300 select-none mb-1">
          ─────────────────────────────────────────────────────
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-gray-500">
          {score !== null && (
            <span>
              <span className="text-gray-400">Survivability:</span>{' '}
              <span className={cn('font-semibold', survivabilityColor(score))}>
                {score}/100
              </span>
            </span>
          )}
          <span>
            <span className="text-gray-400">{runs.length}</span>{' '}
            {runs.length === 1 ? 'run' : 'runs'}
          </span>
          <span>
            <span className="text-gray-400">{signerCount}</span>{' '}
            {signerCount === 1 ? 'signer' : 'signers'}
          </span>
          <span>
            <span className="text-gray-400">{gapCount}</span>{' '}
            {gapCount === 1 ? 'gap' : 'gaps'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ReplayChronology;
