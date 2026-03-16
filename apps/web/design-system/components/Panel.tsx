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
        'rounded-[var(--vt-radius-lg)] border shadow-[var(--vt-shadow-panel)]',
        subtle
          ? 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface-subtle)]'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface)]',
        'p-[var(--vt-space-20)] text-[var(--vt-text-primary)]',
        className,
      )}
      {...props}
    />
  );
}
