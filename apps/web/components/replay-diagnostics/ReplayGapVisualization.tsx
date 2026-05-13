'use client';

/**
 * ReplayGapVisualization.tsx
 *
 * Renders gaps in the replay chain as institutional audit blocks.
 * Empty state = success. Gap blocks use dashed borders for warning/critical.
 *
 * Example:
 *   GAP 1 of 2
 *     After:    run:a1b2c3d4  →  before: run:ffffffff
 *     Duration: 47 days
 *     Type:     DATA GAP
 *     Severity: ● WARNING
 */

export interface ReplayGap {
  afterRunId: string;
  beforeRunId: string | null;
  gapDays: number;
  gapType: 'data_gap' | 'signer_rotation' | 'actor_mismatch' | 'stale_run';
  severity: 'info' | 'warning' | 'critical';
}

export interface ReplayGapVisualizationProps {
  gaps: ReplayGap[];
  totalRuns: number;
}

const GAP_TYPE_LABELS: Record<ReplayGap['gapType'], string> = {
  data_gap: 'DATA GAP',
  signer_rotation: 'SIGNER ROTATION',
  actor_mismatch: 'ACTOR MISMATCH',
  stale_run: 'STALE RUN',
};

const SEVERITY_CONFIG: Record<
  ReplayGap['severity'],
  { containerCls: string; dotCls: string; label: string }
> = {
  info: {
    containerCls: 'border border-dashed border-gray-200 bg-gray-50',
    dotCls: 'text-gray-400',
    label: 'INFO',
  },
  warning: {
    containerCls: 'border border-dashed border-amber-200 bg-amber-50',
    dotCls: 'text-amber-500',
    label: 'WARNING',
  },
  critical: {
    containerCls: 'border border-dashed border-red-300 bg-red-50',
    dotCls: 'text-red-500',
    label: 'CRITICAL',
  },
};

function GapTypeDescription({
  gapType,
  gapDays,
}: {
  gapType: ReplayGap['gapType'];
  gapDays: number;
}) {
  switch (gapType) {
    case 'data_gap':
      return (
        <span className="text-xs text-gray-600">
          A {gapDays}-day interval exceeds the expected freshness window.
        </span>
      );
    case 'signer_rotation':
      return (
        <span className="text-xs text-gray-600">
          Signing key changed between these runs.
        </span>
      );
    case 'actor_mismatch':
      return (
        <span className="text-xs text-gray-600">
          Actor attribution differs between these runs.
        </span>
      );
    case 'stale_run':
      return (
        <span className="text-xs text-gray-600">
          Run data is older than the permitted staleness threshold ({gapDays} days).
        </span>
      );
  }
}

function GapBlock({
  gap,
  index,
  total,
}: {
  gap: ReplayGap;
  index: number;
  total: number;
}) {
  const cfg = SEVERITY_CONFIG[gap.severity];

  return (
    <div className={`p-3 ${cfg.containerCls}`}>
      {/* Header */}
      <div className="mb-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-gray-500">
          GAP {index + 1} of {total}
        </span>
      </div>

      {/* Detail rows */}
      <div className="space-y-1">
        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-20 flex-shrink-0">
            After
          </span>
          <span className="font-mono text-xs text-gray-900">
            run:{gap.afterRunId.slice(0, 8)}
          </span>
          <span className="font-mono text-xs text-gray-400">→</span>
          <span className="font-mono text-xs text-gray-900">
            {gap.beforeRunId ? `run:${gap.beforeRunId.slice(0, 8)}` : 'current'}
          </span>
        </div>

        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-20 flex-shrink-0">
            Duration
          </span>
          <span className="font-mono text-xs font-semibold text-gray-900">
            {gap.gapDays} days
          </span>
        </div>

        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-20 flex-shrink-0">
            Type
          </span>
          <span className="font-mono text-[9px] uppercase text-gray-600">
            {GAP_TYPE_LABELS[gap.gapType]}
          </span>
        </div>

        <div className="flex gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-gray-400 w-20 flex-shrink-0">
            Severity
          </span>
          <span className={`font-mono text-[10px] uppercase ${cfg.dotCls}`}>
            ● {cfg.label}
          </span>
        </div>

        <div className="pt-1">
          <GapTypeDescription gapType={gap.gapType} gapDays={gap.gapDays} />
        </div>
      </div>
    </div>
  );
}

export function ReplayGapVisualization({
  gaps,
  totalRuns,
}: ReplayGapVisualizationProps) {
  const criticalCount = gaps.filter((g) => g.severity === 'critical').length;
  const warningCount = gaps.filter((g) => g.severity === 'warning').length;

  return (
    <div className="bg-white">
      {/* Anchor band */}
      <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          REPLAY GAPS
        </span>
      </div>

      <div className="px-3 py-2">
        {gaps.length === 0 ? (
          <p className="text-xs text-green-700">
            ✓ No gaps in replay chain. Continuity confirmed.
          </p>
        ) : (
          <div className="space-y-2">
            {gaps.map((gap, i) => (
              <GapBlock key={`${gap.afterRunId}-${i}`} gap={gap} index={i} total={gaps.length} />
            ))}
          </div>
        )}
      </div>

      {/* Footer summary */}
      {gaps.length > 0 && (
        <div className="px-3 py-1.5 border-t border-gray-100">
          <span className="font-mono text-[10px] text-gray-400">
            {gaps.length} gap{gaps.length !== 1 ? 's' : ''}&nbsp;&nbsp;·&nbsp;&nbsp;
            {criticalCount} critical&nbsp;&nbsp;·&nbsp;&nbsp;
            {warningCount} warning&nbsp;&nbsp;·&nbsp;&nbsp;
            {totalRuns} total run{totalRuns !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
