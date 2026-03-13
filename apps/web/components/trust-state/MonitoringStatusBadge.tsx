'use client';

import { Activity, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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
            {active ? 'Continuously Monitored' : 'Monitoring Inactive'}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p>
            {active
              ? `Verification is automatically monitored for changes.`
              : 'Continuous monitoring is currently turned off.'}
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
