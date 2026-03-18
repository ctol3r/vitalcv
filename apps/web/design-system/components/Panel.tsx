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
        'rounded-2xl transition-all duration-300 backdrop-blur-md shadow-sm',
        subtle
          ? 'bg-[var(--vt-surface-subtle)] ring-1 ring-[var(--vt-border-subtle)]/50'
          : 'bg-[var(--vt-surface)] ring-1 ring-[var(--vt-border)]/20 shadow-[0_4px_24px_rgba(0,0,0,0.02)]',
        'p-4 text-[var(--vt-text-primary)]',
        className,
      )}
      {...props}
    />
  );
}
