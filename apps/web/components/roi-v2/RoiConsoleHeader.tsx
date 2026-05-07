import * as React from 'react';
import { cn } from '@/lib/utils';
import { ROI_V2_EXPORTS } from '@/lib/roi-v2/fixtures';
import type {
  RoiV2ExportKind,
  RoiV2Pilot,
  RoiV2StatusBlock,
} from '@/lib/roi-v2/types';
import { RoiStatusPip } from './RoiStatusPip';

export interface RoiConsoleHeaderProps {
  pilot: RoiV2Pilot;
  status: RoiV2StatusBlock;
  onExport?: (kind: RoiV2ExportKind) => void;
}

/**
 * Top-of-page identity + window progress + export buttons for the ROI
 * Console v2.
 *
 * Export buttons are placeholders — `onExport` is invoked with the export
 * kind, and the caller is responsible for wiring the real handler. The
 * default RoiClient implementation logs to console with `recordedBy: 'demo'`.
 */
export function RoiConsoleHeader({
  pilot,
  status,
  onExport,
}: RoiConsoleHeaderProps) {
  const elapsedPct = Math.round(
    (pilot.daysElapsed / pilot.pilotWindowDays) * 100,
  );
  const progressBarColor =
    status.state === 'blocked'
      ? 'bg-rose-500'
      : status.state === 'trailing'
        ? 'bg-amber-500'
        : status.state === 'complete'
          ? 'bg-slate-500'
          : 'bg-emerald-600';

  return (
    <div className="border border-slate-200 rounded-[3px] bg-white px-6 py-5">
      <div className="flex items-start justify-between gap-6 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              ROI Console · {pilot.pilotId}
            </span>
            <RoiStatusPip state={status.state} />
          </div>
          <h1 className="text-[26px] font-semibold tracking-[-0.018em] text-slate-900 leading-tight">
            {pilot.orgName}
          </h1>
          <p className="mt-1 text-[12.5px] text-slate-600 leading-[1.55] max-w-[68ch]">
            {status.summary}
          </p>
          <div className="mt-2 font-mono text-[10.5px] text-slate-500">
            Started {pilot.pilotStartedAt} · As of {status.asOf}
          </div>
        </div>
        <div className="flex-shrink-0 min-w-[240px]">
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-500">
              Pilot window · {pilot.daysElapsed} of {pilot.pilotWindowDays}d
            </span>
            <span className="font-mono text-[11px] tabular-nums text-slate-700">
              {elapsedPct}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-label="Pilot window progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={elapsedPct}
            className="h-1.5 bg-slate-100 rounded-full overflow-hidden"
          >
            <div
              className={cn('h-full', progressBarColor)}
              style={{ width: `${elapsedPct}%` }}
            />
          </div>
          {onExport && (
            <div className="mt-3 flex items-center gap-2 justify-end flex-wrap">
              {ROI_V2_EXPORTS.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => onExport(ex.id)}
                  title={ex.sub}
                  className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-slate-700 hover:text-slate-900 hover:underline"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
