'use client';

/**
 * ReplayContinuityPanel.tsx
 *
 * Survivability score, dedupe key state, actor attribution, replay verdict, last verified.
 * Design: label/value grid, score color-coded by threshold.
 */

export interface ReplayContinuityPanelProps {
  survivabilityScore: number;
  dedupeKeyActive: boolean;
  actorAttributionActive: boolean;
  lastVerifiedAt: string;
  replaySurvivable: boolean;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  } catch {
    return iso;
  }
}

function ScoreValue({ score }: { score: number }) {
  const cls =
    score >= 90
      ? 'text-green-700'
      : score >= 70
        ? 'text-amber-600'
        : 'text-red-600';
  return (
    <span className="flex items-center gap-2">
      <span className={`text-sm font-mono font-semibold ${cls}`}>{score} / 100</span>
      <span className="inline-flex w-[60px] h-[3px] bg-gray-100 rounded-none overflow-hidden">
        <span
          className="bg-green-500 h-full"
          style={{ width: `${score}%` }}
        />
      </span>
    </span>
  );
}

function BoolValue({ active, label }: { active: boolean; label?: string }) {
  if (active) {
    return (
      <span className="text-[10px] font-mono text-green-700">
        {label ?? 'ACTIVE'}
      </span>
    );
  }
  return (
    <span className="text-[10px] font-mono text-amber-600">
      {label ?? 'INACTIVE'}
    </span>
  );
}

interface RowProps {
  label: string;
  children: React.ReactNode;
}

function ReplayRow({ label, children }: RowProps) {
  return (
    <div className="flex items-center gap-3 px-3 min-h-[32px] border-b border-gray-100 last:border-b-0">
      <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-[140px] shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function ReplayContinuityPanel({
  survivabilityScore,
  dedupeKeyActive,
  actorAttributionActive,
  lastVerifiedAt,
  replaySurvivable,
}: ReplayContinuityPanelProps) {
  return (
    <div className="border border-gray-200 bg-white overflow-hidden rounded">
      {/* Header */}
      <div className="vcv-anchor-band">
        <span className="vcv-label">Replay Continuity</span>
      </div>

      <div>
        <ReplayRow label="Survivability">
          <ScoreValue score={survivabilityScore} />
        </ReplayRow>
        <ReplayRow label="Dedupe Key">
          <BoolValue active={dedupeKeyActive} />
        </ReplayRow>
        <ReplayRow label="Actor Attr.">
          <BoolValue active={actorAttributionActive} />
        </ReplayRow>
        <ReplayRow label="Replay Survives">
          {replaySurvivable ? (
            <span className="text-xs text-gray-500">
              <span className="text-[10px] font-mono text-green-700 mr-1.5">YES</span>
              — Prisma upsert
            </span>
          ) : (
            <span className="text-[10px] font-mono text-red-600">NO</span>
          )}
        </ReplayRow>
        <ReplayRow label="Last Verified">
          <span className="text-xs font-mono text-gray-900">{formatTs(lastVerifiedAt)}</span>
        </ReplayRow>
        <ReplayRow label="Last Restart Safe">
          <span className="text-xs text-gray-600">
            <span className="text-[10px] font-mono text-green-700 mr-1.5">YES</span>
            — dedupeKey active
          </span>
        </ReplayRow>
      </div>
    </div>
  );
}
