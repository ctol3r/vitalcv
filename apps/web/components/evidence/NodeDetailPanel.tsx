'use client';

import * as React from 'react';
import { CheckCircle2, AlertCircle, Clock, ShieldX, Database } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming standard cn utility is available

export type TrustState = 'VERIFIED' | 'PENDING' | 'REJECTED' | 'UNKNOWN';

export interface NodeDetailProps {
  id: string;
  title: string;
  type: string;
  trustState: TrustState;
  source: string;
  timestamp: string;
  description?: string;
  className?: string;
}

export function NodeDetailPanel({
  id,
  title,
  type,
  trustState,
  source,
  timestamp,
  description,
  className,
}: NodeDetailProps) {
  // Pure Black & White Minimal
  const isVerified = trustState === 'VERIFIED';
  
  const statusConfig = {
    VERIFIED: { icon: CheckCircle2, label: 'Verified', class: 'text-black' },
    PENDING: { icon: Clock, label: 'Pending Verification', class: 'text-neutral-500' },
    REJECTED: { icon: ShieldX, label: 'Verification Failed', class: 'text-black' },
    UNKNOWN: { icon: AlertCircle, label: 'Unknown State', class: 'text-neutral-400' },
  };

  const StatusIcon = statusConfig[trustState].icon;

  return (
    <div className={cn(
      "w-full max-w-md bg-white border-2 border-black p-6 font-sans text-black relative",
      className
    )}>
      {/* Decorative Minimal Dots */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-20">
        <div className="w-1.5 h-1.5 bg-black rounded-full" />
        <div className="w-1.5 h-1.5 bg-black rounded-full" />
        <div className="w-1.5 h-1.5 bg-black rounded-full" />
      </div>

      <header className="mb-8 border-b-2 border-black pb-4">
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">
            {type}
          </span>
          <span className="font-mono text-[10px] text-neutral-400">
            {id}
          </span>
        </div>
        
        <h2 className="text-2xl font-bold tracking-tight leading-tight mb-4">
          {title}
        </h2>

        <div className="flex items-center gap-2">
          <StatusIcon className={cn("w-5 h-5 stroke-[2.5]", statusConfig[trustState].class)} />
          <span className={cn("text-xs font-bold uppercase tracking-wider", statusConfig[trustState].class)}>
            {statusConfig[trustState].label}
          </span>
        </div>
      </header>

      {description && (
        <div className="mb-8">
          <p className="text-sm leading-relaxed text-neutral-800">
            {description}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-px bg-black border-2 border-black">
        <div className="bg-white p-4">
          <span className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Source</span>
          <div className="flex items-center gap-1.5 align-middle">
            <Database className="w-3 h-3 text-black" />
            <span className="text-xs font-semibold">{source}</span>
          </div>
        </div>
        <div className="bg-white p-4">
          <span className="block text-[10px] uppercase font-bold text-neutral-500 mb-1">Timestamp</span>
          <div className="flex items-center gap-1.5 align-middle">
            <Clock className="w-3 h-3 text-black" />
            <span className="text-xs font-semibold">{timestamp}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
