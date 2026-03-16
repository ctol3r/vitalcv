import type React from 'react';
import { cn } from '@/lib/utils';

export interface ListLayoutProps {
  header?: React.ReactNode;
  filters?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function ListLayout({
  children,
  className,
  filters,
  footer,
  header,
}: ListLayoutProps) {
  return (
    <div className={cn('space-y-[var(--vt-space-16)]', className)}>
      {header}
      {filters}
      <div className="space-y-[var(--vt-space-16)]">{children}</div>
      {footer}
    </div>
  );
}
