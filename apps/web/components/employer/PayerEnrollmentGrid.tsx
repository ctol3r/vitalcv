'use client';

/**
 * PayerEnrollmentGrid — Commercial payer enrollment tracker.
 *
 * A clinician isn't revenue-generating until enrollment attaches per payer.
 * This grid renders one dense chip per lane (Medicare PECOS + commercial
 * payers), each using the canonical trust color vocabulary.
 *
 * Doctrine
 * --------
 *   - One chip per lane — no free-text labels beyond the configured vocabulary
 *   - tabular-nums on the "observed" timestamp so chips align in dense grids
 *   - Status → color mapping routes through CSS vars so dark/light parity
 *     happens automatically
 *   - Absent data renders as 'Unchecked' — never as 'Enrolled' by default
 */

import React from 'react';
import { Check, Clock3, Link2Off, Lock, ShieldAlert, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

void React;
import type {
  PayerEnrollmentLane,
  PayerEnrollmentStatus,
} from '@/lib/clinical/privilege-types';

interface PayerEnrollmentGridProps {
  payers: PayerEnrollmentLane[];
  className?: string;
  title?: string;
  description?: string;
  columns?: 2 | 3 | 4;
}

interface StatusStyle {
  icon: LucideIcon;
  label: string;
  containerClass: string;
  iconClass: string;
  labelClass: string;
}

const STATUS_STYLES: Record<PayerEnrollmentStatus, StatusStyle> = {
  verified: {
    icon: Check,
    label: 'Verified',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-success)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-success)_12%,transparent)]',
    iconClass: 'text-[var(--vt-success)]',
    labelClass: 'text-[var(--vt-success)]',
  },
  processing: {
    icon: Clock3,
    label: 'Processing',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-info)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-info)_10%,transparent)]',
    iconClass: 'text-[var(--vt-info)]',
    labelClass: 'text-[var(--vt-info)]',
  },
  awaiting_npi: {
    icon: Lock,
    label: 'Awaiting NPI link',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-warning)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-warning)_10%,transparent)]',
    iconClass: 'text-[var(--vt-warning)]',
    labelClass: 'text-[var(--vt-warning)]',
  },
  awaiting_caqh: {
    icon: Lock,
    label: 'Awaiting CAQH',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-warning)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-warning)_10%,transparent)]',
    iconClass: 'text-[var(--vt-warning)]',
    labelClass: 'text-[var(--vt-warning)]',
  },
  action_required: {
    icon: ShieldAlert,
    label: 'Action required',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-danger)_40%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-danger)_10%,transparent)]',
    iconClass: 'text-[var(--vt-danger)]',
    labelClass: 'text-[var(--vt-danger)]',
  },
  not_enrolled: {
    icon: Link2Off,
    label: 'Not enrolled',
    containerClass:
      'border-[color:color-mix(in_oklch,var(--vt-danger)_35%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-danger)_8%,transparent)]',
    iconClass: 'text-[var(--vt-danger)]',
    labelClass: 'text-[var(--vt-danger)]',
  },
  unchecked: {
    icon: Zap,
    label: 'Unchecked',
    containerClass: 'border-[var(--vt-border)] bg-white/[0.02]',
    iconClass: 'text-muted-foreground/50',
    labelClass: 'text-muted-foreground/70',
  },
};

const COLUMN_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
};

function formatObservedAt(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

export function PayerEnrollmentGrid({
  payers,
  className,
  title = 'Commercial payer enrollment',
  description,
  columns = 2,
}: PayerEnrollmentGridProps) {
  const verifiedCount = payers.filter((p) => p.status === 'verified').length;
  const totalCount = payers.length;

  return (
    <section
      data-slot="payer-enrollment-grid"
      className={cn(
        'rounded-2xl border border-[var(--vt-border)] bg-card px-5 py-4',
        className,
      )}
      aria-label={title}
    >
      <header className="flex flex-col gap-2 border-b border-white/6 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            {title}
          </p>
          {description && (
            <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
              {description}
            </p>
          )}
        </div>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
          <span className="text-foreground/80">{verifiedCount}</span>
          <span className="text-muted-foreground/40"> / </span>
          <span className="text-muted-foreground/70">{totalCount}</span>
          <span className="ml-1 text-muted-foreground/40">verified</span>
        </p>
      </header>

      {payers.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground/50">
          No payer lanes are being tracked for this clinician yet.
        </p>
      ) : (
        <div className={cn('mt-3 grid gap-2', COLUMN_CLASS[columns])}>
          {payers.map((lane) => {
            const style = STATUS_STYLES[lane.status] ?? STATUS_STYLES.unchecked;
            const Icon = style.icon;
            const observed = formatObservedAt(lane.observedAt ?? null);
            return (
              <div
                key={lane.id}
                className={cn(
                  'flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                  style.containerClass,
                )}
                data-payer-id={lane.id}
                data-payer-status={lane.status}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/30 bg-black/20',
                    style.iconClass,
                  )}
                  aria-hidden="true"
                >
                  <Icon className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                    <p className="truncate font-mono text-[11px] uppercase tracking-wide text-foreground/85">
                      {lane.label}
                    </p>
                    <p
                      className={cn(
                        'font-mono text-[10px] uppercase tracking-widest whitespace-nowrap',
                        style.labelClass,
                      )}
                    >
                      {style.label}
                    </p>
                  </div>
                  {(lane.note || observed) && (
                    <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/60">
                      {lane.note ? <span>{lane.note}</span> : null}
                      {lane.note && observed ? (
                        <span aria-hidden="true" className="mx-1 text-muted-foreground/30">·</span>
                      ) : null}
                      {observed ? (
                        <time
                          dateTime={lane.observedAt ?? undefined}
                          className="font-mono tabular-nums text-muted-foreground/55"
                        >
                          {observed}
                        </time>
                      ) : null}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default PayerEnrollmentGrid;
