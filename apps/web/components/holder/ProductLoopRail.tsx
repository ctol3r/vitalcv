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
  const doc = variant === 'doc';

  // `doc` stays native to the `.vcv-doc` paper register (readiness / recognition).
  // Every other mount is calm glass: `mz` on the root makes the Calm Wave tokens
  // resolve wherever the rail lands, so it is self-contained.
  const containerClass = doc ? 'vcv-panel p-4 sm:p-5' : 'mz mz-glass p-4 sm:p-5';
  const headingClass = doc ? 'vcv-eyebrow' : 'mz-eyebrow';

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
                className={stageLinkClass(doc)}
                style={doc ? stageDocStyle(isCurrent) : stageCalmStyle(isCurrent)}
              >
                <span
                  className={badgeClass(doc)}
                  style={doc ? badgeDocStyle({ isDone, isCurrent }) : badgeCalmStyle({ isDone, isCurrent })}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span
                    className="truncate text-[13px] font-semibold"
                    style={doc ? { color: 'var(--ink-strong)' } : undefined}
                  >
                    <span
                      aria-hidden="true"
                      className={doc ? 'vcv-subtle' : 'mz-mono'}
                      style={doc ? undefined : { color: 'var(--ink-400)' }}
                    >
                      {idx + 1}.
                    </span>{' '}
                    {stage.label}
                  </span>
                  <span
                    className={statusClass(doc)}
                    style={doc ? statusDocStyle({ isDone, isCurrent }) : statusCalmStyle({ isDone, isCurrent })}
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

function stageLinkClass(doc: boolean): string {
  if (doc) return 'group flex h-full items-center gap-2.5 rounded-2xl border px-3 py-2.5 transition-colors';
  // Calm inset step — recessed well, hairline that darkens on hover; the current
  // step's accent border/wash is layered on top via stageCalmStyle.
  return 'group flex h-full items-center gap-2.5 rounded-[3px] px-3 py-2.5 mz-inset mz-interactive';
}

function stageDocStyle(isCurrent: boolean): React.CSSProperties {
  return isCurrent
    ? { borderColor: 'color-mix(in oklch, var(--accent) 45%, transparent)', background: 'color-mix(in oklch, var(--accent) 8%, transparent)' }
    : { borderColor: 'var(--hairline-color, color-mix(in oklch, var(--ink) 14%, transparent))', background: 'transparent' };
}

function stageCalmStyle(isCurrent: boolean): React.CSSProperties | undefined {
  if (!isCurrent) return undefined;
  return {
    borderColor: 'color-mix(in oklch, var(--accent) 45%, transparent)',
    background: 'color-mix(in oklch, var(--accent) 8%, transparent)',
  };
}

function badgeClass(doc: boolean): string {
  const base = 'flex h-8 w-8 shrink-0 items-center justify-center text-[13px] font-semibold';
  return doc ? `${base} rounded-xl` : `${base} rounded-[3px]`;
}

function badgeDocStyle({ isDone, isCurrent }: { isDone: boolean; isCurrent: boolean }): React.CSSProperties {
  if (isDone) return { background: 'color-mix(in oklch, var(--state-verified) 18%, transparent)', color: 'var(--state-verified)' };
  if (isCurrent) return { background: 'var(--accent)', color: 'var(--paper, #fff)' };
  return { background: 'color-mix(in oklch, var(--ink) 8%, transparent)', color: 'var(--ink-mute)' };
}

function badgeCalmStyle({ isDone, isCurrent }: { isDone: boolean; isCurrent: boolean }): React.CSSProperties {
  if (isDone) return { background: 'color-mix(in oklch, var(--ok) 18%, transparent)', color: 'var(--ok)' };
  if (isCurrent) return { background: 'var(--accent)', color: 'var(--paper)' };
  return { background: 'color-mix(in oklch, var(--ink-900) 8%, transparent)', color: 'var(--ink-400)' };
}

function statusClass(doc: boolean): string {
  if (doc) return 'truncate text-[11px]';
  // Mono, uppercase micro-label — the eyebrow idiom for the step's state.
  return 'mz-mono truncate text-[10px] uppercase tracking-[0.14em]';
}

function statusDocStyle({ isDone, isCurrent }: { isDone: boolean; isCurrent: boolean }): React.CSSProperties {
  if (isDone) return { color: 'var(--state-verified)' };
  if (isCurrent) return { color: 'var(--accent)' };
  return { color: 'var(--ink-mute)' };
}

function statusCalmStyle({ isDone, isCurrent }: { isDone: boolean; isCurrent: boolean }): React.CSSProperties {
  if (isDone) return { color: 'var(--ok)' };
  if (isCurrent) return { color: 'var(--accent)' };
  return { color: 'var(--ink-400)' };
}

export default ProductLoopRail;
