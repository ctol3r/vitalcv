'use client';

/**
 * ProductLoopRail — the VitalCV clinician loop, made legible on every signed-in
 * surface: Profile → Readiness → Recognition → Share / Prove → Opportunity.
 *
 * It answers "what is this product and what do I do next" at a glance, and every
 * stage is a real link to a live surface. Stage status is derived only from data
 * the caller already knows to be true (profile completeness, whether a readiness
 * snapshot exists) plus `activeStage` — the surface the clinician is currently
 * on. Nothing here fabricates a score, a Recognition, or an NPI; stages we
 * cannot assert are simply shown as open steps.
 *
 * Variants:
 *  - `dark` — the signed-in mobile/dashboard surfaces (white-on-ink cards).
 *  - `light` — generic light surfaces (global `--vt-*` tokens).
 *  - `doc`  — the `.vcv-doc` document surfaces (readiness / recognition), so the
 *             rail reads as native paper-register chrome rather than a foreign card.
 */

import * as React from 'react';
import Link from 'next/link';
import { Award, Compass, IdCard, Share2, ShieldCheck, type LucideIcon } from 'lucide-react';

export type LoopStageKey = 'profile' | 'readiness' | 'recognition' | 'share' | 'opportunity';
export type LoopStageStatus = 'done' | 'current' | 'open';
export type LoopVariant = 'dark' | 'light' | 'doc';

type LoopStage = {
  key: LoopStageKey;
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
  /** The stage of the surface the clinician is currently viewing. */
  activeStage?: LoopStageKey;
  variant?: LoopVariant;
  className?: string;
}

function buildStages(input: {
  npi?: string | null;
  profileComplete: boolean;
  hasReadiness: boolean;
  activeStage?: LoopStageKey;
}): LoopStage[] {
  const hasNpi = typeof input.npi === 'string' && /^\d{10}$/.test(input.npi);
  const shareHref = hasNpi ? `/verify/${input.npi}` : '/holder';

  const profileStatus: LoopStageStatus = input.profileComplete ? 'done' : 'current';
  const readinessStatus: LoopStageStatus = input.hasReadiness
    ? 'done'
    : input.profileComplete
      ? 'current'
      : 'open';

  const stages: LoopStage[] = [
    { key: 'profile', label: 'Profile', icon: IdCard, href: '/clinician/profile', status: profileStatus },
    { key: 'readiness', label: 'Readiness', icon: ShieldCheck, href: '/holder/readiness', status: readinessStatus },
    { key: 'recognition', label: 'Recognition', icon: Award, href: '/holder/recognition', status: 'open' },
    { key: 'share', label: 'Share / prove', icon: Share2, href: shareHref, status: 'open' },
    { key: 'opportunity', label: 'Opportunity', icon: Compass, href: '/holder/opportunities', status: 'open' },
  ];

  // The surface you are on is where you are — mark it current, even if a data
  // heuristic would otherwise call an earlier step current.
  if (input.activeStage) {
    for (const stage of stages) {
      if (stage.key === input.activeStage) stage.status = 'current';
      else if (stage.status === 'current') stage.status = stage.key === 'profile' ? profileStatus === 'done' ? 'done' : 'open' : 'open';
    }
  }

  return stages;
}

export function ProductLoopRail({
  npi,
  profileComplete = false,
  hasReadiness = false,
  activeStage,
  variant = 'dark',
  className,
}: ProductLoopRailProps) {
  const stages = buildStages({ npi, profileComplete, hasReadiness, activeStage });
  const dark = variant === 'dark';
  const doc = variant === 'doc';

  const containerClass = doc
    ? 'vcv-panel p-4 sm:p-5'
    : [
        'rounded-[28px] border p-4 sm:p-5',
        dark
          ? 'border-white/10 bg-white/[0.04] shadow-[0_20px_60px_rgba(0,0,0,0.28)]'
          : 'border-[var(--vt-border-subtle)] bg-[color-mix(in_oklab,var(--vt-surface)_94%,white)]',
      ].join(' ');

  const headingClass = doc
    ? 'vcv-eyebrow'
    : [
        'text-[11px] font-semibold uppercase tracking-[0.18em]',
        dark ? 'text-white/45' : 'text-[var(--vt-text-muted)]',
      ].join(' ');

  return (
    <nav aria-label="Your VitalCV loop" data-product-loop-rail="" className={[containerClass, className ?? ''].join(' ')}>
      <p className={headingClass}>Your VitalCV loop</p>

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
                aria-current={isCurrent ? 'step' : undefined}
                className={stageLinkClass({ variant, isCurrent })}
                style={doc ? stageDocStyle(isCurrent) : undefined}
              >
                <span className={badgeClass({ variant, isDone, isCurrent })} style={doc ? badgeDocStyle({ isDone, isCurrent }) : undefined}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className={['truncate text-[13px] font-semibold', dark ? 'text-white' : doc ? '' : 'text-[var(--vt-text-primary)]'].join(' ')}
                    style={doc ? { color: 'var(--ink-strong)' } : undefined}
                  >
                    <span aria-hidden="true" className={dark ? 'text-white/40' : doc ? 'vcv-subtle' : 'text-[var(--vt-text-muted)]'}>
                      {idx + 1}.
                    </span>{' '}
                    {stage.label}
                  </span>
                  <span className={statusClass({ variant, isDone, isCurrent })} style={doc ? statusDocStyle({ isDone, isCurrent }) : undefined}>
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

function stageLinkClass({ variant, isCurrent }: { variant: LoopVariant; isCurrent: boolean }): string {
  const base = 'group flex h-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-colors';
  if (variant === 'doc') return base;
  if (variant === 'dark') {
    return [base, isCurrent ? 'border-emerald-400/40 bg-emerald-400/10 hover:border-emerald-300/60' : 'border-white/10 bg-black/20 hover:border-white/25'].join(' ');
  }
  return [base, isCurrent ? 'border-emerald-600/50 bg-emerald-500/10' : 'border-[var(--vt-border-subtle)] bg-[var(--vt-surface)] hover:border-[var(--vt-text-primary)]'].join(' ');
}

function stageDocStyle(isCurrent: boolean): React.CSSProperties {
  return isCurrent
    ? { borderColor: 'color-mix(in oklch, var(--accent) 45%, transparent)', background: 'color-mix(in oklch, var(--accent) 8%, transparent)' }
    : { borderColor: 'var(--hairline-color, color-mix(in oklch, var(--ink) 14%, transparent))', background: 'transparent' };
}

function badgeClass({ variant, isDone, isCurrent }: { variant: LoopVariant; isDone: boolean; isCurrent: boolean }): string {
  const base = 'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[13px] font-semibold';
  if (variant === 'doc') return base;
  if (isDone) return [base, 'bg-emerald-400/20 text-emerald-200'].join(' ');
  if (isCurrent) return [base, 'bg-emerald-400 text-zinc-950'].join(' ');
  return [base, variant === 'dark' ? 'bg-white/10 text-white/70' : 'bg-[var(--vt-surface-subtle)] text-[var(--vt-text-muted)]'].join(' ');
}

function badgeDocStyle({ isDone, isCurrent }: { isDone: boolean; isCurrent: boolean }): React.CSSProperties {
  if (isDone) return { background: 'color-mix(in oklch, var(--state-verified) 18%, transparent)', color: 'var(--state-verified)' };
  if (isCurrent) return { background: 'var(--accent)', color: 'var(--paper, #fff)' };
  return { background: 'color-mix(in oklch, var(--ink) 8%, transparent)', color: 'var(--ink-mute)' };
}

function statusClass({ variant, isDone, isCurrent }: { variant: LoopVariant; isDone: boolean; isCurrent: boolean }): string {
  const base = 'truncate text-[11px]';
  if (variant === 'doc') return base;
  if (isDone) return [base, 'text-emerald-300'].join(' ');
  if (isCurrent) return [base, variant === 'dark' ? 'text-emerald-200' : 'text-emerald-700'].join(' ');
  return [base, variant === 'dark' ? 'text-white/45' : 'text-[var(--vt-text-muted)]'].join(' ');
}

function statusDocStyle({ isDone, isCurrent }: { isDone: boolean; isCurrent: boolean }): React.CSSProperties {
  if (isDone) return { color: 'var(--state-verified)' };
  if (isCurrent) return { color: 'var(--accent)' };
  return { color: 'var(--ink-mute)' };
}

export default ProductLoopRail;
