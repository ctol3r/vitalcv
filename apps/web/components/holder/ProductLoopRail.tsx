'use client';

/**
 * ProductLoopRail — the VitalCV clinician loop, made legible on every signed-in
 * surface: Profile → Readiness → Recognition → Share / Prove → Opportunity.
 *
 * It answers "what is this product and what do I do next" at a glance, and every
 * stage is a real link to a live surface. Stage status is derived only from data
 * the caller already knows to be true (profile completeness, whether a readiness
 * snapshot exists). Nothing here fabricates a score, a Recognition, or an NPI —
 * stages we cannot assert are simply shown as open steps.
 */

import * as React from 'react';
import Link from 'next/link';
import { Award, Compass, IdCard, Share2, ShieldCheck, type LucideIcon } from 'lucide-react';

export type LoopStageStatus = 'done' | 'current' | 'open';

type LoopStage = {
  key: string;
  label: string;
  icon: LucideIcon;
  href: string;
  status: LoopStageStatus;
};

export interface ProductLoopRailProps {
  /** 10-digit NPI, when known — drives the Share/Prove destination. */
  npi?: string | null;
  /** True when the profile record is materially complete. */
  profileComplete?: boolean;
  /** True when a source-backed readiness snapshot exists. */
  hasReadiness?: boolean;
  /** Optional heading tone; defaults to the dark signed-in surfaces. */
  variant?: 'dark' | 'light';
  className?: string;
}

function buildStages(input: {
  npi?: string | null;
  profileComplete: boolean;
  hasReadiness: boolean;
}): LoopStage[] {
  const hasNpi = typeof input.npi === 'string' && /^\d{10}$/.test(input.npi);
  const shareHref = hasNpi ? `/verify/${input.npi}` : '/holder';

  // The "current" step is the first one not yet satisfied. Steps we cannot
  // truthfully assert (Recognition depends on an employer; Share/Opportunity
  // are always available) stay 'open' rather than claiming completion.
  const profileStatus: LoopStageStatus = input.profileComplete ? 'done' : 'current';
  const readinessStatus: LoopStageStatus = input.hasReadiness
    ? 'done'
    : input.profileComplete
      ? 'current'
      : 'open';

  return [
    { key: 'profile', label: 'Profile', icon: IdCard, href: '/clinician/profile', status: profileStatus },
    { key: 'readiness', label: 'Readiness', icon: ShieldCheck, href: '/holder/readiness', status: readinessStatus },
    { key: 'recognition', label: 'Recognition', icon: Award, href: '/holder/recognition', status: 'open' },
    { key: 'share', label: 'Share / prove', icon: Share2, href: shareHref, status: 'open' },
    { key: 'opportunity', label: 'Opportunity', icon: Compass, href: '/holder/opportunities', status: 'open' },
  ];
}

export function ProductLoopRail({
  npi,
  profileComplete = false,
  hasReadiness = false,
  variant = 'dark',
  className,
}: ProductLoopRailProps) {
  const stages = buildStages({ npi, profileComplete, hasReadiness });
  const dark = variant === 'dark';

  return (
    <nav
      aria-label="Your VitalCV loop"
      data-product-loop-rail=""
      className={[
        'rounded-[28px] border p-4 sm:p-5',
        dark
          ? 'border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.28)]'
          : 'border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)]',
        className ?? '',
      ].join(' ')}
    >
      <p
        className={[
          'text-[11px] font-semibold uppercase tracking-[0.18em]',
          dark ? 'text-white/45' : 'text-[var(--vt-text-muted)]',
        ].join(' ')}
      >
        Your VitalCV loop
      </p>

      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          const isDone = stage.status === 'done';
          const isCurrent = stage.status === 'current';
          return (
            <li key={stage.key} className="min-w-0">
              <Link
                href={stage.href}
                data-loop-stage={stage.key}
                data-loop-status={stage.status}
                className={[
                  'group flex h-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-colors',
                  dark
                    ? isCurrent
                      ? 'border-emerald-400/40 bg-emerald-400/10 hover:border-emerald-300/60'
                      : 'border-white/10 bg-black/20 hover:border-white/25'
                    : isCurrent
                      ? 'border-emerald-600/50 bg-emerald-500/10'
                      : 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] hover:border-[var(--vt-text-primary)]',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold',
                    isDone
                      ? 'bg-emerald-400/20 text-emerald-200'
                      : isCurrent
                        ? 'bg-emerald-400 text-zinc-950'
                        : dark
                          ? 'bg-white/10 text-white/70'
                          : 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={[
                      'truncate text-[13px] font-semibold',
                      dark ? 'text-white' : 'text-[var(--vt-text-primary)]',
                    ].join(' ')}
                  >
                    <span aria-hidden="true" className={dark ? 'text-white/40' : 'text-[var(--vt-text-muted)]'}>
                      {idx + 1}.
                    </span>{' '}
                    {stage.label}
                  </span>
                  <span
                    className={[
                      'truncate text-[11px]',
                      isDone
                        ? 'text-emerald-300'
                        : isCurrent
                          ? dark ? 'text-emerald-200' : 'text-emerald-700'
                          : dark ? 'text-white/45' : 'text-[var(--vt-text-muted)]',
                    ].join(' ')}
                  >
                    {isDone ? 'Done' : isCurrent ? 'You are here' : 'Open'}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ProductLoopRail;
