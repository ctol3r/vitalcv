'use client';

import { Activity, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Wave 37 P0 hardening: this badge formerly read "Continuously
 * Monitored" and described verification as "automatically monitored
 * for changes". VitalCV does NOT continuously monitor; lanes are
 * resolved per-request against the published federal sources. The
 * badge now names the per-request posture honestly: lanes are
 * re-checked when a request is made, on the institution's freshness
 * budget.
 */
export function MonitoringStatusBadge({
  active = true,
  lastMonitoredAt,
}: {
  active?: boolean;
  lastMonitoredAt?: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`cursor-help inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border ${
              active
                ? 'bg-blue-50/50 text-blue-700 border-blue-200 hover:bg-blue-50'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {active ? (
              <Activity className="h-3 w-3 text-blue-500" />
            ) : (
              <Clock className="h-3 w-3 text-slate-400" />
            )}
            {active
              ? 'Re-checked on request'
              : 'Per-request re-checks disabled'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {active
              ? 'Lanes are resolved per request against the published federal sources on the institution’s own freshness budget. No continuous monitoring is performed.'
              : 'Per-request re-checks are currently turned off.'}
          </p>
          {lastMonitoredAt && (
            <p className="mt-1 text-[10px] opacity-80">
              Last checked: {new Date(lastMonitoredAt).toLocaleString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
