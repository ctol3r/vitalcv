'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Layers, FileCheck, Anchor, CircleDashed } from 'lucide-react';

export interface EvidenceItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  isAnchor?: boolean; // Final root of trust
}

export interface EvidenceStackProps {
  items: EvidenceItem[];
  className?: string;
}

export function EvidenceStack({ items, className }: EvidenceStackProps) {
  return (
    <div className={cn("font-sans w-full max-w-lg", className)}>
      <div className="flex items-center gap-2 mb-6 pb-2 border-b-2 border-black">
        <Layers className="w-5 h-5" />
        <h3 className="text-sm font-bold uppercase tracking-widest text-black">Evidence Stack</h3>
      </div>

      <div className="flex flex-col relative before:absolute before:inset-y-0 before:left-3.5 before:w-0.5 before:bg-black/10">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const Icon = item.isAnchor ? Anchor : (isLast ? CircleDashed : FileCheck);

          return (
            <div key={item.id} className="relative pl-10 py-4 group">
              {/* Timeline dot */}
              <div className="absolute left-0 top-5 w-7 h-7 bg-white border-2 border-black rounded-full flex items-center justify-center z-10">
                <Icon className="w-3.5 h-3.5 text-black" />
              </div>

              {/* Content Card */}
              <div className={cn(
                "p-4 bg-white border-2 transition-all duration-200",
                item.isAnchor ? "border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "border-neutral-200 hover:border-black"
              )}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-semibold text-sm text-black">{item.title}</span>
                  <span className="text-[10px] font-mono text-neutral-500">{item.timestamp}</span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  {item.description}
                </p>
                
                {item.isAnchor && (
                  <div className="mt-3 pt-3 border-t-2 border-dashed border-black/20 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse" />
                    <span className="text-[10px] uppercase font-bold tracking-wider text-black">Cryptographic Anchor Reached</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
