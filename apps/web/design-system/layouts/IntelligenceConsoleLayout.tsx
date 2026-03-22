import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { buildIntelligenceHref, deriveIntelligenceNavKey, type IntelligenceNavKey } from '@/lib/intelligence/routes';
import { getPilotIntelligenceNav } from '@/lib/pilot-flags';
import { cn } from '@/lib/utils';

const DEFAULT_NAV = getPilotIntelligenceNav().map((item) => ({
  ...item,
  href:
    item.key === 'dashboard' ? buildIntelligenceHref('dashboard')
    : item.key === 'investigations' ? buildIntelligenceHref('investigations')
    : buildIntelligenceHref('actions'),
}));

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
    <div className="flex w-full min-h-screen flex-col bg-[var(--vt-bg)] text-[var(--vt-text-1)] font-sans">
      {/* Slim chrome bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-[var(--vt-border)] bg-[var(--vt-surface)] px-4">
        <nav className="flex items-center gap-1" aria-label="Intelligence navigation">
          <Link
            href={buildIntelligenceHref('dashboard')}
            className="mr-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--vt-text-1)]"
          >
            VitalCV
          </Link>
          {DEFAULT_NAV.map((item) => {
            const active = resolvedNavKey === item.key;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest transition',
                  active
                    ? 'bg-[var(--vt-surface-2)] text-[var(--vt-text-1)]'
                    : 'text-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4">
          {actions}
          <kbd className="hidden rounded border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-0.5 text-[10px] text-[var(--vt-text-3)] sm:block">
            ⌘K
          </kbd>
        </div>
      </header>

      {/* Breadcrumb + page title — compact */}
      <div className="border-b border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {breadcrumbs.length > 0 ? (
              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[10px] text-[var(--vt-text-3)]">
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
                    {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                    {crumb.href ? (
                      <Link href={crumb.href} className="uppercase tracking-widest transition hover:text-[var(--vt-text-1)]">{crumb.label}</Link>
                    ) : (
                      <span className="uppercase tracking-widest text-[var(--vt-text-1)]">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            ) : null}
            <h1 className="truncate text-sm font-semibold text-[var(--vt-text-1)]">{title}</h1>
            {meta ? <div className="hidden text-xs text-[var(--vt-text-3)] lg:block">{meta}</div> : null}
          </div>
        </div>
        {banner}
      </div>

      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
