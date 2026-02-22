'use client';

import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface VitaTokenBalanceProps {
  balance: number;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  VitaTokenBalance — compact header widget                           */
/* ------------------------------------------------------------------ */

export function VitaTokenBalance({ balance, className }: VitaTokenBalanceProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full',
        'px-3 py-1 text-xs font-medium',
        'glass glass-border',
        className,
      )}
      title={`${balance} VITA tokens earned`}
    >
      <Zap className="h-3.5 w-3.5 text-[var(--accent)]" />
      <span className="tabular-nums">{balance.toLocaleString()}</span>
      <span className="text-muted-foreground">VITA</span>
    </div>
  );
}
