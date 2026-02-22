'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
  /** Left panel width ratio 0-1, default 0.5 */
  ratio?: number;
  className?: string;
}

/**
 * Left/right split layout. On mobile it stacks vertically.
 * Uses CSS grid with a fixed ratio — no drag resize for now.
 */
export function SplitView({ left, right, ratio = 0.5, className }: SplitViewProps) {
  const leftFr = Math.round(ratio * 100);
  const rightFr = 100 - leftFr;

  return (
    <div
      className={cn('grid gap-4', className)}
      style={{
        gridTemplateColumns: `${leftFr}fr ${rightFr}fr`,
      }}
    >
      <div className="min-w-0 overflow-auto">{left}</div>
      <div className="min-w-0 overflow-auto">{right}</div>
    </div>
  );
}
