'use client';

/**
 * @deprecated — migrating to canonical Card. Import from '@/components/ui/card' instead.
 */

import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

interface CardPatternProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export function CardPattern({ children, className, glowColor: _g }: CardPatternProps) {
  return (
    <div
      className={cn(
        'rounded-[var(--vt-radius-lg)]',
        'border border-[var(--vt-border)]',
        'bg-[var(--vt-surface)] text-[var(--vt-text-primary)]',
        'p-[var(--vt-space-24)]',
        className,
      )}
    >
      {children}
    </div>
  );
}
