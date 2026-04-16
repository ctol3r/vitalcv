'use client';

/**
 * @deprecated — migrating to canonical Card. Import from '@/components/ui/card' instead.
 */

import { cn } from '@/lib/utils';

interface SpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  radius?: number;
}

export function SpotlightCard({ children, className, color: _c, radius: _r }: SpotlightCardProps) {
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
