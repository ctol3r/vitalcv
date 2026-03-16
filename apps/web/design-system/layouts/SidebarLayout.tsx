import type React from 'react';
import { cn } from '@/lib/utils';

export function SidebarLayout({
  sidebar,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-[var(--vt-space-24)] lg:grid-cols-[16rem_minmax(0,1fr)]', className)}>
      <aside className="space-y-[var(--vt-space-12)]">{sidebar}</aside>
      <section className="min-w-0 space-y-[var(--vt-space-16)]">{children}</section>
    </div>
  );
}
