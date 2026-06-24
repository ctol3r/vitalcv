'use client';

/**
 * Ecosystem Feed (Wave 300, D3) — the clinician career activity feed, projected
 * from the timeline layer: evidence verified, trust reinforcement/decay, mobility
 * changes, recognition. Derived from recorded evidence timestamps (not a substitute
 * for the audit log); honest about what is recorded.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CareerEvent, TimelineProjection } from '@vitalcv/domain-evidence';

function formatDate(value: string | null): string {
  if (!value) return 'Undated';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function tone(e: CareerEvent): string {
  if (e.trustImpact < 0) return 'text-rose-700';
  if (e.mobilityImpact === 'expands') return 'text-emerald-700';
  if (e.recognitionImpact !== 'none') return 'text-sky-700';
  return 'text-foreground';
}

function badge(e: CareerEvent): string {
  if (e.trustImpact < 0) return 'decay';
  if (e.mobilityImpact === 'expands') return 'mobility unlock';
  if (e.recognitionImpact !== 'none') return e.recognitionImpact;
  if (e.trustImpact > 0) return 'source-backed';
  return e.type.replace(/_/g, ' ');
}

export default function ActivityClient({ entityId }: { entityId: string }) {
  const [timeline, setTimeline] = useState<TimelineProjection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/timeline/${encodeURIComponent(entityId)}`, { cache: 'no-store' });
      if (cancelled) return;
      setTimeline(res.ok ? ((await res.json()) as TimelineProjection) : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  if (loading) return <main className="mx-auto w-full max-w-2xl px-4 py-16"><p className="text-sm text-muted-foreground">Loading activity…</p></main>;
  if (!timeline) return <main className="mx-auto w-full max-w-2xl px-4 py-16"><p className="text-sm text-muted-foreground">Activity not available.</p></main>;

  const events = [...timeline.events].reverse();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Activity</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Career Feed</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {timeline.trustHistory.reinforcementCount} reinforcement{timeline.trustHistory.reinforcementCount === 1 ? '' : 's'} · {timeline.trustHistory.decayCount} decay · trend {timeline.trustHistory.trend}
            {' · '}<Link href={`/ecosystem/${encodeURIComponent(entityId)}`} className="hover:text-foreground">← Ecosystem</Link>
          </p>
        </header>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recorded activity yet.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-border pl-5">
            {events.map((e) => (
              <li key={e.eventId} className="relative">
                <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full border border-border bg-card" />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className={`text-sm font-medium ${tone(e)}`}>{e.label}</p>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{badge(e)}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {e.evidenceSource ?? '—'} · {formatDate(e.occurredAt)}
                  {e.trustDimension ? ` · ${e.trustDimension}` : ''}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}
