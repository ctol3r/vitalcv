import * as React from 'react';

import {
  ALL_SOURCE_IDS,
  type SourceHealthSnapshot,
  type SourceHealthState,
  type SourceId,
} from '@/lib/source-health/sourceHealthTypes';

interface SourceHealthPublicPanelProps {
  snapshots: ReadonlyArray<SourceHealthSnapshot>;
  /** Optional override for the rendered "as of" timestamp. Defaults to the
   *  newest observedAt in `snapshots`. */
  observedAt?: string | null;
}

const SOURCE_LABEL: Record<SourceId, string> = {
  NPPES: 'NPPES (NPI registry)',
  OIG_LEIE: 'OIG LEIE (exclusion list)',
  PECOS: 'PECOS (Medicare enrollment)',
  STATE_BOARD: 'State medical boards',
};

const STATE_BADGE: Record<
  SourceHealthState,
  { label: string; className: string; description: string }
> = {
  LIVE: {
    label: 'Live',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
    description:
      'The source responded within the latest probe window. Evidence may be upgraded against this source.',
  },
  DEGRADED: {
    label: 'Degraded',
    className: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
    description:
      'The source is responding but slow or partially failing. Evidence is not upgraded while degraded.',
  },
  UNAVAILABLE: {
    label: 'Unavailable',
    className: 'border-red-500/30 bg-red-500/10 text-red-700',
    description:
      'The source is not responding. Evidence is not upgraded while unavailable.',
  },
  RATE_LIMITED: {
    label: 'Rate limited',
    className: 'border-orange-500/30 bg-orange-500/10 text-orange-700',
    description:
      'Source is throttling our requests. Evidence is not upgraded while rate limited.',
  },
  UNKNOWN: {
    label: 'Unknown',
    className: 'border-slate-400/40 bg-slate-500/10 text-slate-600',
    description:
      'No probe result yet. Evidence is not upgraded while state is unknown.',
  },
};

function newestObservedAt(snaps: ReadonlyArray<SourceHealthSnapshot>): string | null {
  if (snaps.length === 0) return null;
  let newest = snaps[0].observedAt;
  for (const s of snaps) {
    if (s.observedAt > newest) newest = s.observedAt;
  }
  return newest;
}

export function SourceHealthPublicPanel({
  snapshots,
  observedAt,
}: SourceHealthPublicPanelProps) {
  const asOf = observedAt ?? newestObservedAt(snapshots);
  const bySource = new Map<SourceId, SourceHealthSnapshot>();
  for (const s of snapshots) bySource.set(s.sourceId, s);

  return (
    <section
      aria-labelledby="source-health-heading"
      className="mb-6 rounded-xl border border-[var(--vt-border,_rgba(0,0,0,0.08))] bg-[var(--vt-surface,_white)] p-4 sm:p-5"
      data-testid="source-health-public-panel"
      data-snapshot-count={String(snapshots.length)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2
          id="source-health-heading"
          className="text-base font-semibold sm:text-lg"
        >
          Source operational health
        </h2>
        {asOf ? (
          <p
            className="text-[10px] uppercase tracking-wider text-muted-foreground"
            data-testid="source-health-as-of"
          >
            As of {asOf}
          </p>
        ) : (
          <p
            className="text-[10px] uppercase tracking-wider text-muted-foreground"
            data-testid="source-health-as-of-empty"
          >
            No probe yet
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-muted-foreground">
        Operational state of upstream credentialing sources. This reports
        availability of the source itself — it does not certify any clinician
        record.
      </p>

      {snapshots.length === 0 ? (
        <p
          className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-600"
          data-testid="source-health-empty-state"
        >
          The source-health probe has not run since the last deploy. Per the
          probe&rsquo;s design, no snapshot is shown until a real result is
          recorded — we do not invent state.
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="source-health-list">
          {ALL_SOURCE_IDS.map((sourceId) => {
            const snap = bySource.get(sourceId);
            if (!snap) {
              return (
                <li
                  key={sourceId}
                  className="rounded-md border border-dashed border-slate-300 p-3 text-xs"
                  data-source-id={sourceId}
                  data-state="MISSING"
                >
                  <p className="font-medium text-foreground">
                    {SOURCE_LABEL[sourceId]}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    No snapshot recorded.
                  </p>
                </li>
              );
            }
            const badge = STATE_BADGE[snap.state];
            return (
              <li
                key={sourceId}
                className="rounded-md border border-border p-3 text-xs"
                data-source-id={sourceId}
                data-state={snap.state}
                data-last-success-at={snap.lastSuccessAt ?? ''}
                data-last-error-at={snap.lastErrorAt ?? ''}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-foreground">
                    {SOURCE_LABEL[sourceId]}
                  </p>
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badge.className}`}
                    aria-label={`State: ${badge.label}`}
                    title={badge.description}
                  >
                    {badge.label}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {snap.reason}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <div>
                    <dt className="uppercase tracking-wider">Last success</dt>
                    <dd className="mt-0.5 font-mono text-foreground/80">
                      {snap.lastSuccessAt ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="uppercase tracking-wider">Last error</dt>
                    <dd className="mt-0.5 font-mono text-foreground/80">
                      {snap.lastErrorAt ?? '—'}
                    </dd>
                  </div>
                  {snap.lastLatencyMs !== null && (
                    <div className="col-span-2">
                      <dt className="uppercase tracking-wider">Last latency</dt>
                      <dd className="mt-0.5 font-mono text-foreground/80">
                        {snap.lastLatencyMs} ms
                      </dd>
                    </div>
                  )}
                </dl>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
