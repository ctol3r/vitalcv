import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PanelProps extends React.HTMLAttributes<HTMLElement> {
  subtle?: boolean;
}

export function Panel({
  className,
  subtle = false,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        'rounded-sm border shadow-none',
        subtle
          ? 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)]'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface)]',
        'p-3 text-[var(--vt-text-primary)]',
        className,
      )}
      {...props}
    />
  );
}
