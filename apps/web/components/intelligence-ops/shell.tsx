import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';

const OPERATIONS_NAV = [
  { href: '/intelligence', label: 'Console' },
  { href: '/findings', label: 'Findings' },
  { href: '/storylines', label: 'Storylines' },
  { href: '/actions', label: 'Actions' },
  { href: '/providers', label: 'Providers' },
  { href: '/investigations', label: 'Investigations' },
  { href: '/system-health', label: 'System Health' },
] as const;

export interface OperationsBreadcrumb {
  label: string;
  href?: string;
}

interface OperationsShellProps {
  activeHref: string;
  title: string;
  description: string;
  breadcrumbs?: OperationsBreadcrumb[];
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
  children: React.ReactNode;
}

export function OperationsShell({
  activeHref,
  title,
  description,
  breadcrumbs = [],
  meta,
  actions,
  banner,
  children,
}: OperationsShellProps) {
  return (
    <main className="ops-shell min-h-screen text-[var(--vt-text-1)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-[var(--vt-shadow-md)]">
          <div className="flex flex-wrap gap-2">
            {OPERATIONS_NAV.map((item) => {
              const active = activeHref === item.href || activeHref.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-sm font-medium transition',
                    active
                      ? 'border-[var(--vt-accent)]/50 bg-[var(--vt-accent)]/15 text-[var(--vt-text-1)]'
                      : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] hover:border-[var(--vt-border-2)] hover:text-[var(--vt-text-1)]',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-[var(--vt-border)] bg-[var(--vt-surface)]/80 p-5 shadow-[var(--vt-shadow-lg)] backdrop-blur sm:p-6">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-[var(--vt-text-2)]">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                    {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-[var(--vt-text-3)]" /> : null}
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="transition hover:text-[var(--vt-text-1)]">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={last ? 'text-[var(--vt-text-1)]' : undefined}>{crumb.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--vt-accent)]">
                Intelligence Operations
              </p>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-[var(--vt-text-1)] sm:text-4xl">
                  {title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-[var(--vt-text-2)] sm:text-base">
                  {description}
                </p>
              </div>
            </div>

            {(meta || actions) ? (
              <div className="flex min-w-0 flex-col gap-3 lg:max-w-sm lg:items-end">
                {meta ? (
                  <div className="text-sm text-[var(--vt-text-2)] lg:text-right">
                    {meta}
                  </div>
                ) : null}
                {actions ? (
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {actions}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {banner}
        {children}
      </div>
    </main>
  );
}
