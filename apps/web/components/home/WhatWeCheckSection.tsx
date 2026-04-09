'use client';

import { CheckCircle2, Lock, ShieldCheck } from 'lucide-react';

const CHECKS = [
  {
    title: 'NPI Identity',
    description:
      'Confirms your identity from the federal provider registry.',
    icon: CheckCircle2,
    status: 'active' as const,
    statusLabel: 'Active',
  },
  {
    title: 'Exclusion Check',
    description:
      'Verifies you are not on any federal exclusion list.',
    icon: ShieldCheck,
    status: 'active' as const,
    statusLabel: 'Active',
  },
  {
    title: 'Medicare Enrollment',
    description:
      'Confirms your Medicare provider enrollment status.',
    icon: CheckCircle2,
    status: 'active' as const,
    statusLabel: 'Active',
  },
  {
    title: 'State License',
    description:
      'Verifies your state medical board license (where available).',
    icon: Lock,
    status: 'requires_access' as const,
    statusLabel: 'Requires Access',
  },
] as const;

const STATUS_STYLES = {
  active: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    icon: 'text-emerald-600 dark:text-emerald-400',
    indicator: '\u2705',
  },
  pending: {
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    icon: 'text-amber-600 dark:text-amber-400',
    indicator: '\u23F3',
  },
  requires_access: {
    badge: 'bg-muted text-muted-foreground',
    icon: 'text-muted-foreground',
    indicator: '\uD83D\uDD12',
  },
} as const;

export function WhatWeCheckSection() {
  return (
    <section className="border-t border-border bg-card px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            What we check
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-muted-foreground">
            Every verification hits the actual federal source — not a cached
            database or self-reported form.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {CHECKS.map((check) => {
            const styles = STATUS_STYLES[check.status];
            const Icon = check.icon;

            return (
              <div
                key={check.title}
                className="flex gap-4 rounded-xl border border-border bg-background p-5"
              >
                <div className="flex-shrink-0">
                  <Icon className={`h-5 w-5 ${styles.icon}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {check.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles.badge}`}
                    >
                      {styles.indicator} {check.statusLabel}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {check.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
