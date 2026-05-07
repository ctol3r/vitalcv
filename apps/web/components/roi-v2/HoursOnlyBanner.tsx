import * as React from 'react';
import type { RoiV2Pilot } from '@/lib/roi-v2/types';

export interface HoursOnlyBannerProps {
  pilot: RoiV2Pilot;
  onAddWage?: () => void;
}

/**
 * Renders a soft amber banner WHEN the org has not entered a default wage in
 * Activation Step 1. The math is identical with or without wage; this banner
 * exists solely to disclose that hours-only mode is active and to provide a
 * one-click path back to set the wage.
 *
 * Returns `null` when wage is set (this component is "off by default").
 */
export function HoursOnlyBanner({ pilot, onAddWage }: HoursOnlyBannerProps) {
  if (pilot.defaultWageUsd != null) return null;
  return (
    <div className="border border-slate-200 rounded-[3px] bg-amber-50/40 px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="text-[12.5px] text-amber-900 leading-[1.55]">
        <span className="font-mono uppercase tracking-[0.14em] text-[10.5px] mr-2 text-amber-800">
          Hours-only mode
        </span>
        You haven&rsquo;t set a default wage. ROI is rendered in reviewer-hours
        throughout this console &mdash; the math is identical, just no dollar
        conversion.
      </div>
      {onAddWage && (
        <button
          type="button"
          onClick={onAddWage}
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] px-3 py-1.5 rounded-[2px] border border-slate-300 bg-white text-slate-900 hover:bg-slate-50"
        >
          Add wage in Activation
        </button>
      )}
    </div>
  );
}
