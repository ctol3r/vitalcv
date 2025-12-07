'use client';

import Link from 'next/link';
import { Shield, RefreshCcw, Share2, Activity, LayoutDashboard } from 'lucide-react';
import { useRoleUX } from '@/contexts/RoleUXContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const ICON_MAP = {
  Shield,
  RefreshCcw,
  Share2,
  Activity,
  LayoutDashboard,
};

export function UniversalActionBar() {
  const { config, role, loading } = useRoleUX();
  const actions = config?.actionBar?.actions ?? [];
  if (!actions.length) {
    return null;
  }

  return (
    <nav
      aria-label={`Universal action bar for ${role}`}
      className="sticky top-0 z-30 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 text-sm shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/75"
    >
      <span className="font-semibold uppercase tracking-tight text-muted-foreground">
        {loading ? 'Loading actions…' : `${role} actions`}
      </span>
      <Separator orientation="vertical" className="h-5" />
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = ICON_MAP[action.icon as keyof typeof ICON_MAP] ?? LayoutDashboard;
          return (
            <Button
              key={action.id}
              variant="secondary"
              size="sm"
              className="gap-2"
              asChild
            >
              <Link href={action.href}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <span>{action.label}</span>
              </Link>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}

