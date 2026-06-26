'use client';

/**
 * Career Intelligence (Wave 320, UI) — renders the deterministic, explainable
 * intelligence: prioritized actions, notifications, and categorized insights.
 * Accessible: heading hierarchy, lists, severity conveyed as text (not color
 * alone). Read-only.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Insight, IntelligenceProjection } from '@vitalcv/domain-evidence';

const SEVERITY_TONE: Record<string, string> = {
  high: 'border-rose-300 text-rose-800',
  medium: 'border-amber-300 text-amber-800',
  low: 'border-slate-300 text-slate-700',
  info: 'border-emerald-300 text-emerald-800',
};
const KIND_LABEL: Record<Insight['kind'], string> = { strength: 'Strength', gap: 'Gap', risk: 'Risk', opportunity: 'Opportunity' };

export default function CareerIntelligenceClient({ entityId }: { entityId: string }) {
  const [data, setData] = useState<IntelligenceProjection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/career-intelligence/${encodeURIComponent(entityId)}`, { cache: 'no-store' });
      if (cancelled) return;
      setData(res.ok ? ((await res.json()) as IntelligenceProjection) : null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  if (loading) return <main className="mx-auto w-full max-w-3xl px-4 py-16"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading intelligence…</p></main>;
  if (!data) return <main className="mx-auto w-full max-w-3xl px-4 py-16"><p className="text-sm text-muted-foreground">Career intelligence not available.</p></main>;

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Career Intelligence</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">What to do next</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.summary.strengths} strengths · {data.summary.gaps} gaps · {data.summary.risks} risks · {data.summary.opportunities} opportunities
            {' · '}<Link href={`/ecosystem/${encodeURIComponent(entityId)}`} className="hover:text-foreground">← Ecosystem</Link>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Deterministic and explainable — every item below derives from source-backed evidence.</p>
        </header>

        {/* Prioritized actions (C3) */}
        <section aria-labelledby="actions-h" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="actions-h" className="mb-3 text-sm font-semibold text-foreground">Prioritized actions</h2>
          {data.actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outstanding actions — coverage is current.</p>
          ) : (
            <ol className="space-y-2">
              {data.actions.map((a) => (
                <li key={a.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground"><span className="text-muted-foreground">{a.rank}.</span> {a.title}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${SEVERITY_TONE[a.priority]}`}>{a.priority} priority</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{a.rationale}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Notifications (C2) */}
        <section aria-labelledby="notify-h" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="notify-h" className="mb-3 text-sm font-semibold text-foreground">Notifications</h2>
          {data.notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notifications.</p>
          ) : (
            <ul className="space-y-2">
              {data.notifications.map((n) => (
                <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="text-foreground">{n.title}</span>
                  <span className="text-xs text-muted-foreground">{n.severity} · {n.category}{n.occurredAt ? ` · ${n.occurredAt.slice(0, 10)}` : ''}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Insights (C1) */}
        <section aria-labelledby="insights-h" className="rounded-2xl border border-border bg-card p-5">
          <h2 id="insights-h" className="mb-3 text-sm font-semibold text-foreground">Insights</h2>
          <ul className="space-y-2">
            {data.insights.map((i) => (
              <li key={i.id} className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{i.title}</p>
                  <p className="text-xs text-muted-foreground">{i.detail}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${SEVERITY_TONE[i.severity]}`}>{KIND_LABEL[i.kind]}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
