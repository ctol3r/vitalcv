'use client';

import { OrgSwitcher } from './OrgSwitcher';
import { DemoHeaderNotifications } from './DemoHeaderNotifications';

interface DemoHeaderProps {
  title: string;
  description?: string;
}

export function DemoHeader({ title, description }: DemoHeaderProps) {
  return (
    <header className="mb-8 border-b pb-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Demo Dashboard</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold">{title}</h1>
              <OrgSwitcher />
            </div>
          </div>
          {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
        </div>
        <DemoHeaderNotifications />
      </div>
    </header>
  );
}
