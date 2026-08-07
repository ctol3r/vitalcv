import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  evaluateRegulatoryFreshness,
  freshnessToneToken,
  type RegulatoryWindow,
  type FreshnessEscalation,
} from '@/lib/freshness/regulatoryWindows';

/**
 * FreshnessMeter (W3) — a regulator-anchored cadence row.
 *
 * Where {@link FreshnessIndicator} shows a bare countdown against a generic
 * window, FreshnessMeter evaluates an evidence lane against its real NCQA/CMS
 * window and renders the industry-legible rhythm: `last checked · next due`,
 * a 90/60/30 escalation cue, a tone-coded horizon bar, and consequence-naming
 * copy (what a stale state actually blocks). Pure / SSR-safe.
 */

const ESCALATION_META: Record<
  FreshnessEscalation,
  { label: string; token: string } | null
> = {
  none: null,
  notice: { label: 'refresh soon', token: 'var(--vt-state-pending)' },
  warning: { label: 'refresh due', token: 'var(--vt-state-pending)' },
  urgent: { label: 'overdue', token: 'var(--vt-state-blocked)' },
};

const TONE_LABEL: Record<string, string> = {
  current: 'Current',
  aging: 'Aging',
  stale: 'Stale',
  expired: 'Expired',
  unknown: 'Not checked',
};

export interface FreshnessMeterProps {
  /** Source/lane name, e.g. "OIG LEIE exclusions". */
  source: string;
  /** ISO instant of the last check, or null if never observed. */
  checkedAt: string | null;
  /** The regulatory window this lane is measured against. */
  window: RegulatoryWindow;
  /** ISO instant treated as "now" (injected for determinism). */
  now: string;
  className?: string;
}

export function FreshnessMeter({
  source,
  checkedAt,
  window,
  now,
  className,
}: FreshnessMeterProps) {
  const f = evaluateRegulatoryFreshness({ checkedAt, window, now });
  const toneColor = freshnessToneToken(f.tone);
  const escalation = ESCALATION_META[f.escalation];

  // Horizon fill: fraction of the window remaining (empty once past).
  const pct =
    f.remainingDays === null
      ? 0
      : Math.max(0, Math.min(100, Math.round((f.remainingDays / f.windowDays) * 100)));

  return (
    <div
      data-freshness-tone={f.tone}
      data-escalation={f.escalation}
      className={cn(
        'flex flex-col gap-1.5 rounded-[10px] border border-[var(--vt-border)] bg-[var(--vt-surface,transparent)] p-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-semibold text-[var(--vt-text-primary)]">
          {source}
        </span>
        <span className="flex items-center gap-2">
          {window.code && (
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
              {window.code}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium"
            style={{ color: toneColor }}
          >
            <span
              aria-hidden="true"
              className="h-[7px] w-[7px] rounded-full"
              style={{ background: toneColor }}
            />
            {TONE_LABEL[f.tone]}
          </span>
        </span>
      </div>

      {/* cadence line: last checked · next due */}
      <div className="font-mono text-[10.5px] tabular-nums text-[var(--vt-text-muted)]">
        {f.ageDays === null ? (
          <>not observed · window {window.windowDays}d · {window.cadence}</>
        ) : (
          <>
            last checked {checkedAt?.slice(0, 10)} · next due{' '}
            <span className="text-[var(--vt-text-secondary)]">{f.nextDueAt}</span>{' '}
            · {window.cadence}
          </>
        )}
      </div>

      {/* horizon bar */}
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--vt-border-subtle,var(--vt-border))]">
        <div
          className="h-full transition-[width] duration-[var(--mz-dur,320ms)]"
          style={{
            width: `${f.tone === 'stale' || f.tone === 'expired' ? 100 : pct}%`,
            background: toneColor,
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] leading-snug text-[var(--vt-text-secondary)]">
          {f.consequence}
        </span>
        {escalation && (
          <span
            className="whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.1em]"
            style={{
              color: escalation.token,
              borderColor: `color-mix(in oklab, ${escalation.token} 45%, transparent)`,
              background: `color-mix(in oklab, ${escalation.token} 10%, transparent)`,
            }}
          >
            {escalation.label}
          </span>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────── */

export interface ExpiryHorizonItem {
  label: string;
  /** ISO date the credential expires. */
  expiresAt: string;
}

export interface ExpiryHorizonProps {
  items: ReadonlyArray<ExpiryHorizonItem>;
  /** ISO instant treated as "now". */
  now: string;
  /** Horizon length in months (default 12). */
  months?: number;
  className?: string;
}

const DAY_MS = 86_400_000;

/**
 * ExpiryHorizon (W3) — a forward horizon strip with a tick per month and a
 * marker per upcoming credential expiry, so staleness is legible across the
 * whole wallet at a glance. Anything already past expiry pins to the left in
 * the blocked tone. Pure / SSR-safe.
 */
export function ExpiryHorizon({
  items,
  now,
  months = 12,
  className,
}: ExpiryHorizonProps) {
  const nowMs = new Date(now).getTime();
  const horizonDays = months * 30;

  const placed = items
    .map((it) => {
      const days = Math.round((new Date(it.expiresAt).getTime() - nowMs) / DAY_MS);
      const pct = Math.max(0, Math.min(100, (days / horizonDays) * 100));
      const past = days < 0;
      const zone: 'urgent' | 'warning' | 'notice' | 'far' =
        days <= 0 ? 'urgent' : days <= 30 ? 'urgent' : days <= 60 ? 'warning' : days <= 90 ? 'notice' : 'far';
      return { ...it, days, pct: past ? 0 : pct, past, zone };
    })
    .sort((a, b) => a.days - b.days);

  const zoneToken: Record<string, string> = {
    urgent: 'var(--vt-state-blocked)',
    warning: 'var(--vt-state-pending)',
    notice: 'var(--vt-state-pending)',
    far: 'var(--vt-state-source-confirmed)',
  };

  return (
    <div className={cn('flex flex-col gap-3', className)} data-expiry-horizon>
      <div className="relative">
        {/* track + month ticks */}
        <div className="relative h-[2px] w-full rounded-full bg-[var(--vt-border)]">
          {Array.from({ length: months + 1 }).map((_, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="absolute top-1/2 h-[6px] w-px -translate-y-1/2 bg-[var(--vt-border)]"
              style={{ left: `${(i / months) * 100}%` }}
            />
          ))}
        </div>
        {/* markers */}
        {placed.map((p, i) => (
          <span
            key={`${p.label}-${i}`}
            data-expiry-zone={p.zone}
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.pct}%` }}
            title={`${p.label} — ${p.past ? `expired ${-p.days}d ago` : `expires in ${p.days}d`}`}
          >
            <span
              aria-hidden="true"
              className="block h-[10px] w-[10px] rounded-full border-2 border-[var(--vt-surface,#fff)]"
              style={{ background: zoneToken[p.zone] }}
            />
          </span>
        ))}
      </div>
      <div className="flex justify-between font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--vt-text-muted)]">
        <span>now</span>
        <span>{months}-month horizon</span>
      </div>
      {/* legend rows */}
      <ul className="flex flex-col gap-1.5">
        {placed.map((p, i) => (
          <li
            key={`row-${p.label}-${i}`}
            className="flex items-center justify-between gap-3 text-[12px]"
          >
            <span className="flex items-center gap-2 text-[var(--vt-text-primary)]">
              <span
                aria-hidden="true"
                className="h-[7px] w-[7px] rounded-full"
                style={{ background: zoneToken[p.zone] }}
              />
              {p.label}
            </span>
            <span className="font-mono text-[10.5px] tabular-nums text-[var(--vt-text-muted)]">
              {p.past ? `expired ${-p.days}d ago` : `expires in ${p.days}d · ${p.expiresAt}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
