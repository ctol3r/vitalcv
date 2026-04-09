import React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ProofDetailRow {
  id: string;
  label: string;
  value: ReactNode;
  tone?: 'default' | 'muted' | 'strong';
}

const VALUE_TONE_CLASS: Record<NonNullable<ProofDetailRow['tone']>, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  strong: 'text-foreground/70',
};

export function ProofDetailsList({
  rows,
  className,
}: {
  rows: ProofDetailRow[];
  className?: string;
}) {
  const visibleRows = rows.filter((row) => {
    if (row.value === null || row.value === undefined || row.value === false) {
      return false;
    }
    return !(typeof row.value === 'string' && row.value.trim().length === 0);
  });

  if (visibleRows.length === 0) {
    return null;
  }

  return (
    <div className={cn('grid gap-2.5', className)}>
      {visibleRows.map((row) => (
        <div
          key={row.id}
          className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 text-[11px] leading-relaxed sm:grid-cols-[110px_minmax(0,1fr)]"
        >
          <span className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/50">
            {row.label}
          </span>
          <div className={cn('min-w-0', VALUE_TONE_CLASS[row.tone ?? 'default'])}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}
