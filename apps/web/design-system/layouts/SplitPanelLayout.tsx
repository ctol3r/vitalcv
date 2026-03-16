import type React from 'react';
import { cn } from '@/lib/utils';

export function SplitPanelLayout({
  left,
  right,
  className,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-[var(--vt-space-16)] lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)]', className)}>
      <section className="min-w-0">{left}</section>
      <aside className="space-y-[var(--vt-space-16)]">{right}</aside>
    </div>
  );
}
