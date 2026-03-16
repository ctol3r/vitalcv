import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { AppLayout } from './AppLayout';
import { cn } from '@/lib/utils';

const DEFAULT_NAV = [
  { href: '/intelligence', label: 'Console' },
  { href: '/findings', label: 'Findings' },
  { href: '/storylines', label: 'Storylines' },
  { href: '/actions', label: 'Actions' },
  { href: '/providers', label: 'Providers' },
  { href: '/investigations', label: 'Investigations' },
  { href: '/calibration', label: 'Calibration' },
  { href: '/system-health', label: 'System Health' },
] as const;

export interface ConsoleBreadcrumb {
  label: string;
  href?: string;
}

export interface IntelligenceConsoleLayoutProps {
  activeHref: string;
  title: string;
  description: string;
  breadcrumbs?: ConsoleBreadcrumb[];
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

export function IntelligenceConsoleLayout({
  activeHref,
  actions,
  banner,
  breadcrumbs = [],
  children,
  description,
  meta,
  title,
}: IntelligenceConsoleLayoutProps) {
  const navigation = (
    <Panel className="space-y-[var(--vt-space-12)]">
      <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.18em] text-[var(--vt-text-muted)]">
        Intelligence navigation
      </p>
      <nav className="flex flex-wrap gap-[var(--vt-space-8)]" aria-label="Console navigation">
        {DEFAULT_NAV.map((item) => {
          const active = activeHref === item.href || activeHref.startsWith(`${item.href}/`);
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
  );

  return (
    <AppLayout header={null} sidebar={null} aside={null} className="ops-shell">
      <div className="space-y-[var(--vt-space-16)]">
        {navigation}
        <Panel className="space-y-[var(--vt-space-16)]">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-[var(--vt-space-8)] text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-secondary)]">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;

                return (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-[var(--vt-space-8)]">
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
          <div className="flex flex-col gap-[var(--vt-space-16)] lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-[var(--vt-space-8)]">
              <p className="text-[length:var(--vt-type-caption-size)] uppercase tracking-[0.24em] text-[var(--vt-accent)]">
                VitalCV Intelligence
              </p>
              <h1 className="text-[length:var(--vt-type-h1-size)] leading-[var(--vt-line-tight)] font-[var(--vt-font-weight-semibold)] text-[var(--vt-text-primary)]">
                {title}
              </h1>
              <p className="max-w-3xl text-[length:var(--vt-type-body-size)] leading-[var(--vt-line-normal)] text-[var(--vt-text-secondary)]">
                {description}
              </p>
            </div>
            {(meta || actions) ? (
              <div className="flex min-w-0 flex-col gap-[var(--vt-space-12)] lg:max-w-sm lg:items-end">
                {meta ? (
                  <div className="text-[length:var(--vt-type-meta-size)] text-[var(--vt-text-secondary)] lg:text-right">
                    {meta}
                  </div>
                ) : null}
                {actions ? <div className="flex flex-wrap gap-[var(--vt-space-8)]">{actions}</div> : null}
              </div>
            ) : null}
          </div>
        </Panel>
        {banner}
        {children}
      </div>
    </AppLayout>
  );
}
