'use client';

/**
 * RevenueReadyCountdown — Dual-metric "time-to-revenue" readout.
 *
 * Hospital finance reality: credentialing clearance is fast relative to
 * commercial payer activation. Reporting a single "time-to-start" hides the
 * trailing constraint (payer enrollment) that actually gates revenue.
 *
 * This panel upgrades the former single-metric TimeToStart summary to a dual
 * readout — credentialing vs revenue activation — with the baseline /
 * time-saved context rendered as secondary rather than headline.
 *
 * Doctrine
 * --------
 *   - tabular-nums on every day range so finance reviewers can scan columns
 *   - Null ranges render as 'Not estimable' rather than a fabricated number
 *   - Revenue lane is visually emphasized as the *longer tail* — that is the
 *     whole point of the split
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { VelocityCountdown } from '@/lib/clinical/privilege-types';

void React;

interface RevenueReadyCountdownProps {
  countdown: VelocityCountdown;
  className?: string;
}

function MetricCard({
  eyebrow,
  value,
  caption,
  tone,
}: {
  eyebrow: string;
  value: string | null;
  caption: string;
  tone: 'credentialing' | 'revenue';
}) {
  const displayValue = value ?? 'Not estimable';
  const isUnknown = value === null;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border px-4 py-4',
        tone === 'credentialing'
          ? 'border-[color:color-mix(in_oklch,var(--vt-info)_35%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-info)_6%,transparent)]'
          : 'border-[color:color-mix(in_oklch,var(--vt-warning)_35%,transparent)] bg-[color:color-mix(in_oklch,var(--vt-warning)_6%,transparent)]',
      )}
      data-velocity-lane={tone}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
        {eyebrow}
      </p>
      <p
        className={cn(
          'mt-2 font-mono text-2xl leading-none tabular-nums tracking-tight',
          isUnknown
            ? 'text-muted-foreground/50'
            : tone === 'credentialing'
              ? 'text-[var(--vt-info)]'
              : 'text-[var(--vt-warning)]',
        )}
      >
        {displayValue}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/60">
        {caption}
      </p>
    </div>
  );
}

export function RevenueReadyCountdown({
  countdown,
  className,
}: RevenueReadyCountdownProps) {
  const { credentialingClearance, revenueActivation, baseline, timeSaved, disclosure } =
    countdown;

  return (
    <section
      data-slot="revenue-ready-countdown"
      className={cn('space-y-3', className)}
      aria-label="Revenue-ready countdown"
    >
      <header className="flex flex-col gap-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
          Velocity · credential + revenue
        </p>
        <p className="text-sm leading-relaxed text-foreground/70">
          A clinician isn&apos;t revenue-generating until commercial payers enroll them.
          VitalCV tracks the two lanes separately because finance and scheduling
          operate on different clocks.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          eyebrow="Credentialing_Clearance"
          value={credentialingClearance}
          caption="Internal privileging + PECOS ready — schedule can be drafted."
          tone="credentialing"
        />
        <MetricCard
          eyebrow="Revenue_Activation"
          value={revenueActivation}
          caption="Commercial payer enrollment complete — claims can be billed."
          tone="revenue"
        />
      </div>

      {(baseline || timeSaved) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {baseline && (
            <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
                Without VitalCV
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground/70">
                {baseline}
              </p>
            </div>
          )}
          {timeSaved && (
            <div className="rounded-xl border border-white/8 bg-black/15 px-3 py-2.5">
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50">
                Time saved
              </p>
              <p className="mt-1 font-mono text-sm tabular-nums text-foreground/70">
                {timeSaved}
              </p>
            </div>
          )}
        </div>
      )}

      {disclosure && (
        <p className="text-[10px] leading-relaxed text-muted-foreground/40">
          {disclosure}
        </p>
      )}
    </section>
  );
}

export default RevenueReadyCountdown;
