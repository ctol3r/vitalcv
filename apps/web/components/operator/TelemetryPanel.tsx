'use client';
import { cn } from '@/lib/utils';
import React from 'react';

export interface TelemetryPanelProps {
  title: string;
  value: string;
  trend?: { value: string; positive?: boolean };
  chart?: React.ReactNode;
  className?: string;
}

export function TelemetryPanel({ title, value, trend, chart, className }: TelemetryPanelProps) {
  return (
    <div className={cn("flex flex-col p-4 bg-[#0f1115] border border-white/5 rounded-xl", className)}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">{title}</h3>
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-semibold text-white tracking-tight">{value}</span>
        {trend && (
          <span className={cn(
            "text-[10px] font-medium px-1.5 py-0.5 rounded-sm",
            trend.positive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400",
            trend.positive === undefined ? "bg-white/5 text-white/40" : ""
          )}>
            {trend.value}
          </span>
        )}
      </div>

      {chart && (
        <div className="mt-4 h-12 w-full">
          {chart}
        </div>
      )}
    </div>
  );
}
