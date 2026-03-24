'use client';
/**
 * VitalCV Design System (VDS) — Canonical Primitives
 * ─────────────────────────────────────────────────────────────
 * This file is the SINGLE SOURCE OF TRUTH for shared UI primitives.
 *
 * Rules:
 *   1. All colors come from --vt-* CSS variables (see /styles/themes/index.css)
 *   2. No hardcoded hex/rgb/slate/zinc — use var(--vt-*) or semantic classes
 *   3. Badge tones use --vt-badge-{tone}-* variables
 *   4. New components belong here, not in ad-hoc surface files
 *   5. Re-exports from intelligence-ops/primitives and intelligence/shared
 *      point here — do not duplicate logic
 *
 * Primitive inventory:
 *   VBadge          — semantic pill badge (severity, status, priority)
 *   VCard           — rounded surface container
 *   VCardSkeleton   — loading shimmer for VCard
 *   VBanner         — alert/info banner with optional icon
 *   VEmptyState     — centered empty state with title + description
 *   VErrorState     — error state with retry button
 *   VSectionHeader  — eyebrow + title + optional action slot
 *   VButton         — minimal theme-aware button
 *   VFilterChip     — toggle chip for filter bars
 *   VTimestamp      — relative time with absolute tooltip
 *   ConfidenceMeter — small progress bar with percentage
 *   ScoreColor      — risk/trust score → CSS class helpers
 *
 * @see /docs/VDS_REFERENCE.md for agent usage guide
 */

import Link from 'next/link';
import { PilotFailureSignal } from '@/components/pilot-ops/PilotFailureSignal';
import { SupportActionButton } from '@/components/pilot-ops/SupportActionButton';
import { normalizeIntelligenceHref } from '@/lib/intelligence/routes';
import { AlertTriangle, ArrowLeft, ChevronDown, RefreshCw } from 'lucide-react';
import type React from 'react';
import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/intelligence/time';
import { getVdsTrustStatusLabel } from '@/lib/trust/status-language';

// ── Badge Tone System ──────────────────────────────────────────────────────────

export type BadgeTone = 'neutral' | 'critical' | 'warning' | 'success' | 'info';

const BADGE_CLASSES: Record<BadgeTone, string> = {
  neutral:  'border-[var(--vt-badge-neutral-border)] bg-[var(--vt-badge-neutral-bg)] text-[var(--vt-badge-neutral-text)]',
  critical: 'border-[var(--vt-badge-critical-border)] bg-[var(--vt-badge-critical-bg)] text-[var(--vt-badge-critical-text)]',
  warning:  'border-[var(--vt-badge-warning-border)] bg-[var(--vt-badge-warning-bg)] text-[var(--vt-badge-warning-text)]',
  success:  'border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] text-[var(--vt-badge-success-text)]',
  info:     'border-[var(--vt-badge-info-border)] bg-[var(--vt-badge-info-bg)] text-[var(--vt-badge-info-text)]',
};

const BADGE_ACCENT_CLASSES: Record<BadgeTone, string> = {
  neutral:  'border-l-[var(--vt-badge-neutral-border)]',
  critical: 'border-l-[var(--vt-badge-critical-border)]',
  warning:  'border-l-[var(--vt-badge-warning-border)]',
  success:  'border-l-[var(--vt-badge-success-border)]',
  info:     'border-l-[var(--vt-badge-info-border)]',
};

export type TrustStatusLabel = Parameters<typeof getVdsTrustStatusLabel>[0];

const TRUST_STATUS_TONES: Record<TrustStatusLabel, BadgeTone> = {
  verified: 'success',
  clear: 'success',
  enrolled: 'success',
  pending: 'info',
  'review required': 'warning',
  unavailable: 'neutral',
  'access required': 'neutral',
  'not decision-grade': 'neutral',
  blocked: 'critical',
};

/** Map a severity/status string to a badge tone. */
export function severityTone(value: string): BadgeTone {
  switch (value.toLowerCase()) {
    case 'critical': case 'outage': case 'revoked':
      return 'critical';
    case 'high': case 'escalated': case 'investigating': case 'expired':
      return 'warning';
    case 'low': case 'saved': case 'verified': case 'executed':
    case 'completed': case 'resolved': case 'healthy': case 'cleared':
      return 'success';
    case 'medium': case 'degraded': case 'pending': case 'in_progress':
    case 'quiet': case 'new': case 'acknowledged':
      return 'info';
    case 'skipped': case 'dismissed':
    default:
      return 'neutral';
  }
}

// ── Score Colors ───────────────────────────────────────────────────────────────

/** Risk score (0–100) → color class. High risk = red. */
export function riskScoreColor(score: number): string {
  if (score >= 75) return 'text-[var(--vt-critical)]';
  if (score >= 50) return 'text-[var(--vt-warning)]';
  if (score >= 25) return 'text-[var(--vt-success)]';
  return 'text-[var(--vt-text-2)]';
}

/** Trust score (0–100) → color class. High trust = green. */
export function trustScoreColor(score: number): string {
  if (score >= 75) return 'text-[var(--vt-success)]';
  if (score >= 50) return 'text-[var(--vt-info)]';
  if (score >= 25) return 'text-[var(--vt-warning)]';
  return 'text-[var(--vt-text-2)]';
}

// ── VBadge ─────────────────────────────────────────────────────────────────────

export function VBadge({
  label,
  tone = 'neutral',
  className,
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <span className={cn(
      'inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest',
      BADGE_CLASSES[tone],
      className,
    )}>
      {label}
    </span>
  );
}

// ── Trust Status Primitives ───────────────────────────────────────────────────

export interface VStatusPillProps {
  status: TrustStatusLabel;
  size?: 'sm' | 'md';
}

export function VStatusPill({
  status,
  size = 'md',
}: VStatusPillProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        BADGE_CLASSES[TRUST_STATUS_TONES[status]],
      )}
    >
      {getVdsTrustStatusLabel(status)}
    </span>
  );
}

export interface VEvidenceRowProps {
  label: string;
  status: TrustStatusLabel;
  source?: string;
  note?: string;
  action?: { label: string; href: string };
}

export function VEvidenceRow({
  label,
  status,
  source,
  note,
  action,
}: VEvidenceRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--vt-border-2)] py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[var(--vt-text-1)]">{label}</p>
        {(source || note || action) ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-[var(--vt-text-3)]">
            {source ? <span>{source}</span> : null}
            {source && note ? <span aria-hidden>·</span> : null}
            {note ? <span>{note}</span> : null}
            {(source || note) && action ? <span aria-hidden>·</span> : null}
            {action ? (
              <Link
                href={action.href}
                className="font-medium text-[var(--vt-accent)] transition hover:opacity-80"
              >
                {action.label}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="shrink-0">
        <VStatusPill status={status} size="sm" />
      </div>
    </div>
  );
}

// ── VCard ──────────────────────────────────────────────────────────────────────

export function VCard({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <section 
      style={style}
      className={cn(
      'rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface)] p-3 shadow-sm',
      className,
    )}>
      {children}
    </section>
  );
}

// ── VCardSkeleton ──────────────────────────────────────────────────────────────

export function VCardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <VCard className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-2 animate-pulse motion-reduce:animate-none">
          <div className="h-3 w-24 rounded-full bg-[var(--vt-border)]" />
          <div className="h-5 w-3/4 rounded-full bg-[var(--vt-surface-2)]" />
          <div className="h-3 w-1/2 rounded-full bg-[var(--vt-surface-2)]" />
        </div>
      ))}
    </VCard>
  );
}

// ── VBanner ────────────────────────────────────────────────────────────────────

const BANNER_ICONS: Partial<Record<BadgeTone, React.ReactNode>> = {
  critical: <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--vt-critical)]" />,
  warning:  <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--vt-warning)]" />,
};

export function VBanner({
  tone = 'info',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      'flex items-start gap-2.5 rounded-md border px-3 py-2 text-xs',
      BADGE_CLASSES[tone],
    )}>
      {BANNER_ICONS[tone]}
      <span>{children}</span>
    </div>
  );
}

// ── VEmptyState ────────────────────────────────────────────────────────────────

export function VEmptyState({
  title,
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  const resolvedTitle = title?.trim() || 'No data available';
  const resolvedDescription = description?.trim() || 'No records are available for the current scope.';

  return (
    <VCard className={cn("border-dashed text-center", className)}>
      <div className="mx-auto max-w-xl space-y-3 py-8">
        <div className="mx-auto h-6 w-6 animate-pulse rounded-full bg-[var(--vt-surface-2)] ring-1 ring-[var(--vt-border)] motion-reduce:animate-none" />
        <h2 className="text-sm font-semibold text-[var(--vt-text-1)]">{resolvedTitle}</h2>
        <p className="text-sm leading-6 text-[var(--vt-text-2)]">{resolvedDescription}</p>
      </div>
    </VCard>
  );
}

// ── VErrorState ────────────────────────────────────────────────────────────────

export function VErrorState({
  title,
  description,
  onRetry,
}: {
  title: string;
  description: string;
  onRetry?: () => void;
}) {
  return (
    <VCard className="border-[var(--vt-badge-critical-border)]">
      <PilotFailureSignal title={title} message={description} severity="medium" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--vt-critical)]" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[var(--vt-text-1)]">{title}</h2>
            <p className="text-sm leading-6 text-[var(--vt-text-2)]">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onRetry ? (
            <VButton onClick={onRetry} variant="ghost" size="sm">
              <RefreshCw className="h-4 w-4" />
              Retry
            </VButton>
          ) : null}
          <SupportActionButton
            label="Contact support"
            title={title}
            messagePrefill={description}
            severity="medium"
            className="vt-btn-micro inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--vt-text-1)] transition hover:bg-[var(--vt-border)]"
          />
        </div>
      </div>
    </VCard>
  );
}

// ── VSectionHeader ─────────────────────────────────────────────────────────────

export function VSectionHeader({
  eyebrow,
  title,
  detail,
  action,
  className,
}: {
  eyebrow?: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">{eyebrow}</p>
          ) : null}
          <h2 className="truncate text-lg font-semibold text-[var(--vt-text-1)]">{title}</h2>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {detail ? <p className="line-clamp-2 text-sm leading-6 text-[var(--vt-text-2)]">{detail}</p> : null}
    </div>
  );
}

// ── VAccordion ────────────────────────────────────────────────────────────────

export interface VAccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  tone?: BadgeTone;
}

export function VAccordion({
  title,
  children,
  defaultOpen = false,
  tone = 'neutral',
}: VAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <section
      className={cn(
        'overflow-hidden rounded-md border border-[var(--vt-border)] border-l-4 bg-[var(--vt-surface)]',
        BADGE_ACCENT_CLASSES[tone],
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[var(--vt-surface-2)] motion-reduce:transition-none"
      >
        <span className="text-sm font-medium text-[var(--vt-text-1)]">{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--vt-text-3)] transition-transform duration-200 motion-reduce:transition-none',
            open ? 'rotate-180' : undefined,
          )}
          aria-hidden
        />
      </button>
      <div
        id={panelId}
        role="region"
        aria-label={title}
        className={cn(
          'overflow-hidden border-t border-[var(--vt-border-2)] transition-[max-height] duration-200 ease-out motion-reduce:transition-none',
          open ? 'max-h-[48rem]' : 'max-h-0',
        )}
      >
        <div className="px-4 py-3">
          {children}
        </div>
      </div>
    </section>
  );
}

// ── VButton ────────────────────────────────────────────────────────────────────

export function VButton({
  children,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  className,
  type = 'button',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'default' | 'ghost' | 'accent';
  size?: 'sm' | 'md';
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}) {
  const base = 'vt-btn-micro inline-flex items-center gap-2 rounded-sm border font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };
  const variants = {
    default: 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-border)]',
    ghost:   'border-transparent bg-transparent text-[var(--vt-text-2)] hover:bg-[var(--vt-surface-2)] hover:text-[var(--vt-text-1)]',
    accent:  'border-[var(--vt-accent)]/30 bg-[var(--vt-accent)]/10 text-[var(--vt-accent)] hover:bg-[var(--vt-accent)]/20',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(base, sizes[size], variants[variant], className)}
    >
      {children}
    </button>
  );
}

// ── VFilterChip ────────────────────────────────────────────────────────────────

export function VFilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-sm border px-2 py-1 text-xs font-medium transition',
        active
          ? 'border-[var(--vt-accent)]/50 bg-[var(--vt-accent)]/15 text-[var(--vt-text-1)]'
          : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-2)] hover:border-[var(--vt-border)] hover:text-[var(--vt-text-1)]',
      )}
    >
      {label}
    </button>
  );
}

// ── VTimestamp ──────────────────────────────────────────────────────────────────

export function VTimestamp({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <span title={formatAbsoluteTime(value)} className="text-xs text-[var(--vt-text-3)]">
      {label} {formatRelativeTime(value)}
    </span>
  );
}

// ── ConfidenceMeter ────────────────────────────────────────────────────────────

export function ConfidenceMeter({
  confidence,
  className,
}: {
  confidence: number;
  className?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100);
  const colorClass =
    pct >= 80 ? 'bg-[var(--vt-success)]' :
    pct >= 60 ? 'bg-[var(--vt-info)]' :
    pct >= 40 ? 'bg-[var(--vt-warning)]' :
    'bg-[var(--vt-critical)]';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--vt-border)]">
        <motion.div 
          className={cn('h-full rounded-full', colorClass)}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        />
      </div>
      <span className="text-xs tabular-nums text-[var(--vt-text-3)]">{pct}%</span>
    </div>
  );
}

// ── ScoreBar ───────────────────────────────────────────────────────────────────

export function ScoreBar({
  value,
  tone,
}: {
  value: number;
  tone?: BadgeTone;
}) {
  const width = `${Math.max(4, Math.min(100, Math.round(value)))}%`;
  const color =
    tone === 'success' ? 'bg-[var(--vt-success)]' :
    tone === 'warning' ? 'bg-[var(--vt-warning)]' :
    tone === 'critical' ? 'bg-[var(--vt-critical)]' :
    'bg-[var(--vt-info)]';

  return (
    <div className="h-2 rounded-full bg-[var(--vt-border)]">
      <motion.div 
        className={cn('h-full rounded-full', color)} 
        initial={{ width: 0 }}
        animate={{ width }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );
}

// ── Navigation Links ───────────────────────────────────────────────────────────

export function VBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-1 text-xs font-medium text-[var(--vt-text-2)] transition hover:bg-[var(--vt-border)] hover:text-[var(--vt-text-1)]">
      <ArrowLeft className="h-4 w-4" />
      {label}
    </Link>
  );
}

export function VEntityLink({ href, label }: { href: string; label: string }) {
  const normalizedHref = normalizeIntelligenceHref(href);
  return (
    <Link href={normalizedHref} className="inline-flex items-center rounded-sm border border-[var(--vt-border)] bg-[var(--vt-surface-2)] px-2 py-1 text-[10px] uppercase tracking-widest font-semibold text-[var(--vt-text-2)] transition hover:bg-[var(--vt-border)] hover:text-[var(--vt-text-1)]">
      {label}
    </Link>
  );
}

export function VBadgeLink({
  href,
  label,
  tone = 'neutral',
  title,
}: {
  href: string;
  label: string;
  tone?: BadgeTone;
  title?: string;
}) {
  return (
    <Link href={href} title={title} className="transition hover:opacity-90">
      <VBadge label={label} tone={tone} className="cursor-pointer" />
    </Link>
  );
}

// ── VPaginationControls ────────────────────────────────────────────────────────

export function VPaginationControls({
  page,
  totalPages,
  hrefForPage,
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--vt-border)] bg-[var(--vt-surface)] px-3 py-2 text-xs text-[var(--vt-text-2)]">
      <span>Page {page} of {totalPages}</span>
      <div className="flex gap-2">
        <Link
          href={hrefForPage(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={cn(
            'rounded-full border px-3 py-1.5 transition',
            page <= 1
              ? 'pointer-events-none border-[var(--vt-border-2)] text-[var(--vt-text-3)]'
              : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-border)]',
          )}
        >Previous</Link>
        <Link
          href={hrefForPage(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={cn(
            'rounded-full border px-3 py-1.5 transition',
            page >= totalPages
              ? 'pointer-events-none border-[var(--vt-border-2)] text-[var(--vt-text-3)]'
              : 'border-[var(--vt-border)] bg-[var(--vt-surface-2)] text-[var(--vt-text-1)] hover:bg-[var(--vt-border)]',
          )}
        >Next</Link>
      </div>
    </div>
  );
}
