import type React from 'react';
import { cn } from '@/lib/utils';

export function DetailLayout({
  aside,
  children,
  className,
}: {
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-[var(--vt-space-24)] xl:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]', className)}>
      <section className="min-w-0 space-y-[var(--vt-space-16)]">{children}</section>
      {aside ? <aside className="space-y-[var(--vt-space-16)]">{aside}</aside> : null}
    </div>
  );
}
