'use client';

/**
 * ReplayHealthMonitor.tsx
 *
 * Replay chain health: survivability score, dedupe, actor attribution, LIVE indicator.
 * Bloomberg label/value grid. No decorative UI.
 */

export interface ReplayHealthMonitorProps {
  survivabilityScore: number;
  dedupeActive: boolean;
  actorAttributionActive: boolean;
  lastVerifiedAt: string;
  runCount: number;
  gapCount: number;
  /** If a run was added in the last 60 min, show LIVE indicator */
  recentRunAt: string | null;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

function isRecent(iso: string | null): boolean {
  if (!iso) return false;
  try {
    return Date.now() - new Date(iso).getTime() < 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function ScoreBar({ score }: { score: number }) {
  const barColor =
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-amber-400' : 'bg-red-500';
  const textColor =
    score >= 80 ? 'text-green-600' : score >= 60 ? 'text-amber-500' : 'text-red-600';
  return (
    <span className="flex items-center gap-2">
      <span className={`font-mono text-xs font-semibold tabular-nums ${textColor}`}>
        {score} / 100
      </span>
      <span className="inline-flex w-[60px] h-[3px] bg-gray-100 overflow-hidden">
        <span className={`${barColor} h-full`} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}

interface GridRowProps {
  label: string;
  children: React.ReactNode;
}

function GridRow({ label, children }: GridRowProps) {
  return (
    <div className="flex items-center gap-3 px-3 min-h-[28px] border-b border-gray-100 last:border-b-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-[140px] shrink-0">
        {label}
      </span>
      <span className="text-xs font-mono text-gray-900 min-w-0">{children}</span>
    </div>
  );
}

export function ReplayHealthMonitor({
  survivabilityScore,
  dedupeActive,
  actorAttributionActive,
  lastVerifiedAt,
  runCount,
  gapCount,
  recentRunAt,
}: ReplayHealthMonitorProps) {
  const status = survivabilityScore >= 80 ? 'HEALTHY' : 'DEGRADED';
  const statusColor = survivabilityScore >= 80 ? 'text-green-600' : 'text-amber-500';
  const live = isRecent(recentRunAt);

  return (
    <div className="border border-gray-200 bg-white">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          Replay Health
        </span>
        {live && (
          <span className="font-mono text-[10px] text-green-600">
            ● LIVE
          </span>
        )}
      </div>

      {/* Grid */}
      <GridRow label="Status">
        <span className={`font-mono text-xs ${statusColor}`}>● {status}</span>
      </GridRow>
      <GridRow label="Survivability">
        <ScoreBar score={survivabilityScore} />
      </GridRow>
      <GridRow label="Dedupe Key">
        <span className={dedupeActive ? 'text-green-700' : 'text-red-600'}>
          {dedupeActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </GridRow>
      <GridRow label="Actor Attr.">
        <span className={actorAttributionActive ? 'text-green-700' : 'text-red-600'}>
          {actorAttributionActive ? 'ACTIVE' : 'INACTIVE'}
        </span>
      </GridRow>
      <GridRow label="Runs">
        <span className="tabular-nums">
          {runCount}
          {gapCount > 0 && (
            <span className="text-amber-600 ml-2">· {gapCount} gap{gapCount !== 1 ? 's' : ''}</span>
          )}
          {gapCount === 0 && <span className="text-gray-400 ml-2">· 0 gaps</span>}
        </span>
      </GridRow>
      <GridRow label="Last Run">
        <span className="tabular-nums text-gray-500">{formatTs(lastVerifiedAt)}</span>
      </GridRow>
      {live && recentRunAt && (
        <GridRow label="Live">
          <span className="font-mono text-[10px] text-green-600">
            ● LIVE (&lt; 60 min ago)
          </span>
        </GridRow>
      )}
    </div>
  );
}
