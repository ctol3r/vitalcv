import * as React from 'react';
import { cn } from '@/lib/utils';
import { Clock, ShieldCheck } from 'lucide-react';

interface VerificationLatencyBadgeProps {
  latencyMs: number;
  trustLevel: string;
  className?: string;
  timestamp?: string;
}

export function VerificationLatencyBadge({
  latencyMs,
  trustLevel,
  timestamp,
  className
}: VerificationLatencyBadgeProps) {
  return (
    <div className={cn("inline-flex items-center gap-3 bg-white px-3 py-1.5 rounded-full border border-emerald-500/10 shadow-sm", className)}>
      <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-500/10">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span className="text-xs font-bold tracking-widest uppercase font-mono">
          {trustLevel}
        </span>
      </div>
      <div className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3 h-3" />
        <span className="text-[10px] font-mono font-medium">Verified in {latencyMs}ms</span>
      </div>
      {timestamp && (
        <React.Fragment>
          <div className="w-[1px] h-3 bg-slate-200" />
          <span className="text-[10px] font-mono text-slate-400 font-medium">
            {timestamp}
          </span>
        </React.Fragment>
      )}
    </div>
  );
}
