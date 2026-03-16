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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_24%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_22%),linear-gradient(180deg,#060b13,#09101b_42%,#070c14)] text-slate-50">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_28px_60px_rgba(2,6,23,0.35)] backdrop-blur">
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
                      ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-100'
                      : 'border-white/10 bg-black/20 text-slate-300 hover:border-white/20 hover:text-white',
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-slate-950/55 p-5 shadow-[0_28px_80px_rgba(2,6,23,0.45)] backdrop-blur sm:p-6">
          {breadcrumbs.length > 0 ? (
            <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-400">
              {breadcrumbs.map((crumb, index) => {
                const last = index === breadcrumbs.length - 1;
                return (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                    {index > 0 ? <ChevronRight className="h-3.5 w-3.5 text-slate-600" /> : null}
                    {crumb.href && !last ? (
                      <Link href={crumb.href} className="transition hover:text-white">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={last ? 'text-white' : undefined}>{crumb.label}</span>
                    )}
                  </span>
                );
              })}
            </nav>
          ) : null}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300/80">
                Intelligence Operations
              </p>
              <div className="space-y-1">
                <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {title}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                  {description}
                </p>
              </div>
            </div>

            {(meta || actions) ? (
              <div className="flex min-w-0 flex-col gap-3 lg:max-w-sm lg:items-end">
                {meta ? (
                  <div className="text-sm text-slate-300 lg:text-right">
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
