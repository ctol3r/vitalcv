'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface AppShellProps {
  topNav: ReactNode;
  sidebar: ReactNode;
  context: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AppShell({
  topNav,
  sidebar,
  context,
  children,
  className,
}: AppShellProps) {
  return (
    <div className={cn('vital-ops-theme vital-shell', className)}>
      <div className="vital-shell__topnav">{topNav}</div>
      <div className="vital-shell__body">
        <aside className="vital-shell__sidebar">{sidebar}</aside>
        <main className="vital-shell__workspace">{children}</main>
        <aside className="vital-shell__context">{context}</aside>
      </div>
    </div>
  );
}
