import * as React from 'react';
import { cn } from '@/lib/utils';
import type { RoiV2Status } from '@/lib/roi-v2/types';

const ROI_V2_STATUS_META: Record<
  RoiV2Status,
  { label: string; cls: string; dot: string }
> = {
  'on-track': {
    label: 'On track',
    cls: 'text-emerald-700 bg-emerald-50 ring-emerald-600/20',
    dot: 'bg-emerald-600',
  },
  trailing: {
    label: 'Trailing',
    cls: 'text-amber-800 bg-amber-50 ring-amber-600/20',
    dot: 'bg-amber-500',
  },
  blocked: {
    label: 'Blocked',
    cls: 'text-rose-700 bg-rose-50 ring-rose-600/20',
    dot: 'bg-rose-500',
  },
  complete: {
    label: 'Complete',
    cls: 'text-slate-700 bg-slate-100 ring-slate-300',
    dot: 'bg-slate-500',
  },
};

export interface RoiStatusPipProps {
  state: RoiV2Status;
  className?: string;
}

/**
 * Compact status pip for the ROI Console v2 header. Pipeline state vocabulary
 * (`on-track | trailing | blocked | complete`) does not overlap with the lane
 * state vocabulary or the confidence-tier vocabulary — it specifically
 * describes pilot-window progress.
 */
export function RoiStatusPip({ state, className }: RoiStatusPipProps) {
  const meta = ROI_V2_STATUS_META[state];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[2px] ring-1 ring-inset',
        'text-[10.5px] font-medium uppercase tracking-[0.06em]',
        meta.cls,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
}

export { ROI_V2_STATUS_META };
