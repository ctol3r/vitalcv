'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OpsBadge, type BadgeTone } from './primitives';

export interface CanvasDecisionMetric {
  label: string;
  value: string;
}

export interface CanvasDecisionAction {
  label: string;
  href?: string;
  onClick?: () => void;
  tone?: 'primary' | 'neutral' | 'critical';
}

export interface CanvasDecisionBacklink {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface CanvasDecisionBlockProps {
  eyebrow: string;
  title: string;
  summary: string;
  badgeLabel?: string | null;
  badgeTone?: BadgeTone;
  metrics?: CanvasDecisionMetric[];
  backlinks?: CanvasDecisionBacklink[];
  recommendations?: string[];
  primaryAction?: CanvasDecisionAction | null;
  secondaryActions?: CanvasDecisionAction[];
  onClose?: () => void;
  children?: ReactNode;
}

function actionToneClasses(tone: CanvasDecisionAction['tone']) {
  switch (tone) {
    case 'critical':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-50 hover:bg-rose-400/15';
    case 'primary':
      return 'border-cyan-400/40 bg-cyan-400 text-slate-950 hover:bg-cyan-300';
    case 'neutral':
    default:
      return 'border-[var(--vt-border)] bg-[var(--vt-surface)] text-[var(--vt-text-2)] hover:border-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]';
  }
}

function DecisionActionButton({
  action,
  primary = false,
}: {
  action: CanvasDecisionAction;
  primary?: boolean;
}) {
  const className = cn(
    'inline-flex items-center justify-center rounded-sm border px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition',
    actionToneClasses(action.tone ?? (primary ? 'primary' : 'neutral')),
  );

  if (action.href) {
    return (
      <Link href={action.href} className={className}>
        {action.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={action.onClick} className={className}>
      {action.label}
    </button>
  );
}

function BacklinkChip({ backlink }: { backlink: CanvasDecisionBacklink }) {
  const className = 'inline-flex items-center rounded-full border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-1 text-xs text-[var(--vt-text-2)] transition hover:border-[var(--vt-text-3)] hover:text-[var(--vt-text-1)]';

  if (backlink.href) {
    return (
      <Link href={backlink.href} className={className}>
        {backlink.label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={backlink.onClick} className={className}>
      {backlink.label}
    </button>
  );
}

export function CanvasDecisionBlock({
  eyebrow,
  title,
  summary,
  badgeLabel,
  badgeTone = 'info',
  metrics = [],
  backlinks = [],
  recommendations = [],
  primaryAction = null,
  secondaryActions = [],
  onClose,
  children,
}: CanvasDecisionBlockProps) {
  return (
    <section className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
            {eyebrow}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--vt-text-1)]">{title}</h3>
            {badgeLabel ? <OpsBadge label={badgeLabel} tone={badgeTone} /> : null}
          </div>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] p-1.5 text-[var(--vt-text-3)] transition hover:text-[var(--vt-text-1)]"
            aria-label={`Close ${title}`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <p className="mt-3 text-sm leading-6 text-[var(--vt-text-2)]">{summary}</p>

      {metrics.length > 0 ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {metrics.map((metric) => (
            <div
              key={`${metric.label}:${metric.value}`}
              className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2.5"
            >
              <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--vt-text-3)]">{metric.label}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--vt-text-1)]">{metric.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {backlinks.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
            Backlinks
          </p>
          <div className="flex flex-wrap gap-2">
            {backlinks.map((backlink) => (
              <BacklinkChip key={backlink.label} backlink={backlink} />
            ))}
          </div>
        </div>
      ) : null}

      {recommendations.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
            Recommended Moves
          </p>
          <div className="space-y-1.5">
            {recommendations.map((recommendation) => (
              <p
                key={recommendation}
                className="rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-dim)] px-3 py-2 text-sm leading-6 text-[var(--vt-text-2)]"
              >
                {recommendation}
              </p>
            ))}
          </div>
        </div>
      ) : null}

      {children ? <div className="mt-4">{children}</div> : null}

      {(primaryAction || secondaryActions.length > 0) ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {primaryAction ? <DecisionActionButton action={primaryAction} primary /> : null}
          {secondaryActions.map((action) => (
            <DecisionActionButton key={action.label} action={action} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
