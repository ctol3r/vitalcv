import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { LiveFeedRibbon } from '@/components/intelligence/LiveFeedRibbon';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import {
  buildIntelligenceGraphHref,
  buildIntelligenceHref,
  deriveIntelligenceNavKey,
  type IntelligenceNavKey,
} from '@/lib/intelligence/routes';
import { cn } from '@/lib/utils';

const DEFAULT_NAV = [
  { key: 'dashboard', href: buildIntelligenceHref('dashboard'), label: 'Dashboard' },
  { key: 'graph', href: buildIntelligenceGraphHref(), label: 'Graph' },
  { key: 'findings', href: buildIntelligenceHref('findings'), label: 'Findings' },
  { key: 'storylines', href: buildIntelligenceHref('storylines'), label: 'Storylines' },
  { key: 'providers', href: buildIntelligenceHref('providers'), label: 'Providers' },
  { key: 'actions', href: buildIntelligenceHref('actions'), label: 'Actions' },
  { key: 'investigations', href: buildIntelligenceHref('investigations'), label: 'Investigations' },
  { key: 'calibration', href: buildIntelligenceHref('calibration'), label: 'Calibration' },
  { key: 'system-health', href: buildIntelligenceHref('system-health'), label: 'System Health' },
] as const;

export interface ConsoleBreadcrumb {
  label: string;
  href?: string;
}

export interface IntelligenceConsoleLayoutProps {
  activeHref: string;
  activeNavKey?: IntelligenceNavKey;
  title: string;
  description: string;
  breadcrumbs?: ConsoleBreadcrumb[];
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

import { GlobalTrustSignals } from './GlobalTrustSignals';

export function IntelligenceConsoleLayout({
  activeHref,
  activeNavKey,
  actions,
  banner,
  breadcrumbs = [],
  children,
  description,
  meta,
  title,
}: IntelligenceConsoleLayoutProps) {
  const resolvedNavKey = activeNavKey ?? deriveIntelligenceNavKey(activeHref);

  return (
    <div className="flex w-full flex-col">
      <div className="space-y-4 mb-4">
        <LiveFeedRibbon />
        <GlobalTrustSignals />
        <Panel className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest text-[var(--vt-text-muted)]">
            Intelligence navigation
          </p>
          <nav className="flex flex-wrap gap-2" aria-label="Console navigation">
            {DEFAULT_NAV.map((item) => {
              const active = resolvedNavKey === item.key;

              return (
                <Button
                  key={item.href}
                  asChild
                  className={cn(active ? '' : 'opacity-90')}
                  size="sm"
                  variant={active ? 'primary' : 'secondary'}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>
        </Panel>
        <Panel className="space-y-3">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[var(--vt-text-secondary)]">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;

                return (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                    {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[var(--vt-text-muted)]" /> : null}
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="transition hover:text-[var(--vt-text-primary)]">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={last ? 'text-[var(--vt-text-primary)]' : undefined}>{crumb.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          ) : null}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-[var(--vt-accent)]">
                VitalCV Intelligence
              </p>
              <h1 className="text-xl leading-tight font-semibold text-[var(--vt-text-primary)]">
                {title}
              </h1>
              <p className="max-w-3xl text-sm leading-snug text-[var(--vt-text-secondary)]">
                {description}
              </p>
            </div>
            {(meta || actions) ? (
              <div className="flex min-w-0 flex-col gap-3 lg:max-w-sm lg:items-end">
                {meta ? (
                  <div className="text-xs text-[var(--vt-text-secondary)] lg:text-right">
                    {meta}
                  </div>
                ) : null}
                {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
              </div>
            ) : null}
          </div>
        </Panel>
        {banner}
      </div>
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
