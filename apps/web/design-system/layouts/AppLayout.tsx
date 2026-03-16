import type React from 'react';
import { cn } from '@/lib/utils';

export interface AppLayoutProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({
  aside,
  children,
  className,
  header,
  sidebar,
}: AppLayoutProps) {
  const gridClass = sidebar && aside
    ? 'lg:grid-cols-[16rem_minmax(0,1fr)_20rem]'
    : sidebar
      ? 'lg:grid-cols-[16rem_minmax(0,1fr)]'
      : aside
        ? 'lg:grid-cols-[minmax(0,1fr)_20rem]'
        : 'lg:grid-cols-1';

  return (
    <main className={cn('min-h-screen bg-[var(--vt-bg)] text-[var(--vt-text-primary)]', className)}>
      {header}
      <div className={cn('mx-auto grid max-w-7xl gap-[var(--vt-space-24)] px-[var(--vt-space-16)] py-[var(--vt-space-24)]', gridClass)}>
        {sidebar ? <aside className="space-y-[var(--vt-space-16)]">{sidebar}</aside> : null}
        <section className="min-w-0 space-y-[var(--vt-space-16)]">{children}</section>
        {aside ? <aside className="space-y-[var(--vt-space-16)]">{aside}</aside> : null}
      </div>
    </main>
  );
}
