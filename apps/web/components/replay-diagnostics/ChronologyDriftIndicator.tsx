'use client';

/**
 * ChronologyDriftIndicator.tsx
 *
 * Shows chronological drift between expected and actual check intervals.
 * All text — no bar charts.
 *
 * Example output:
 *   CHRONOLOGY DRIFT
 *   ──────────────────────────────────────
 *   FRESHNESS WINDOW  24 hours
 *   LAST INTERVAL     26h 14m  ← 2h 14m LATE
 *   DRIFT STATUS      ⚠ LATE — outside freshness window
 */

export interface DriftMetrics {
  expectedIntervalMs: number | null; // null = no expectation
  actualIntervalMs: number | null;   // null = only one run
  driftMs: number | null;
  driftDirection: 'early' | 'late' | 'on_time' | 'unknown';
}

export interface ChronologyDriftIndicatorProps {
  drift: DriftMetrics;
  /** Lane freshness window label e.g. "24 hours" */
  freshnessWindow: string;
}

function formatDuration(ms: number): string {
  const totalMinutes = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function DriftStatusLine({
  direction,
  driftMs,
}: {
  direction: DriftMetrics['driftDirection'];
  driftMs: number | null;
}) {
  if (direction === 'unknown' || driftMs === null) {
    return (
      <span className="font-mono text-xs text-gray-400">
        — UNKNOWN (first run)
      </span>
    );
  }

  const driftLabel = formatDuration(driftMs);

  if (direction === 'on_time') {
    return (
      <span className="font-mono text-xs text-green-600">✓ ON TIME</span>
    );
  }

  if (direction === 'late') {
    return (
      <span className="font-mono text-xs text-amber-600">
        ⚠ LATE — {driftLabel} outside freshness window
      </span>
    );
  }

  // early
  return (
    <span className="font-mono text-xs text-blue-600">↑ EARLY</span>
  );
}

function LabelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 min-h-[28px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 w-[160px] flex-shrink-0">
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function ChronologyDriftIndicator({
  drift,
  freshnessWindow,
}: ChronologyDriftIndicatorProps) {
  const intervalLabel =
    drift.actualIntervalMs !== null
      ? formatDuration(drift.actualIntervalMs)
      : '—';

  const driftSuffix =
    drift.driftMs !== null && drift.driftDirection !== 'unknown' && drift.driftDirection !== 'on_time'
      ? `  ← ${formatDuration(drift.driftMs)} ${drift.driftDirection.toUpperCase()}`
      : '';

  return (
    <div className="bg-white">
      {/* Anchor band */}
      <div className="px-3 py-1.5 border-b border-gray-200 bg-gray-50">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
          CHRONOLOGY DRIFT
        </span>
      </div>

      <div className="px-3 py-2 divide-y divide-gray-100">
        <LabelRow label="FRESHNESS WINDOW">
          <span className="font-mono text-xs text-gray-900">{freshnessWindow}</span>
        </LabelRow>
        <LabelRow label="LAST INTERVAL">
          <span className="font-mono text-xs font-semibold text-gray-900">
            {intervalLabel}
          </span>
          {driftSuffix && (
            <span className="font-mono text-xs text-amber-600 ml-1">{driftSuffix}</span>
          )}
        </LabelRow>
        <LabelRow label="DRIFT STATUS">
          <DriftStatusLine
            direction={drift.driftDirection}
            driftMs={drift.driftMs}
          />
        </LabelRow>
      </div>
    </div>
  );
}
