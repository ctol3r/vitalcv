'use client';

/**
 * Professional Growth surface (Wave 600) — a thin, accessible view over the growth
 * API (milestones / progression / gaps). Carries the shared WorkspaceNav.
 */

import { useEffect, useState } from 'react';
import type { ProfessionalGrowthProjection } from '@vitalcv/domain-evidence';
import { fetchJson } from '@/lib/workspace/fetch-json';
import { WorkspaceNav } from '@/components/workspace/WorkspaceNav';

export default function ProfessionalGrowthClient({ entityId }: { entityId: string }) {
  const [data, setData] = useState<ProfessionalGrowthProjection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const d = await fetchJson<ProfessionalGrowthProjection>(`/api/professional-growth/${encodeURIComponent(entityId)}`);
      if (!cancelled) { setData(d); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  return (
    <main className="min-h-screen bg-background">
      <WorkspaceNav entityId={entityId} active="professional-growth" />
      <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Professional Growth</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">Career arc</h1>
        </header>

        {loading ? (
          <p role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading growth…</p>
        ) : !data ? (
          <p className="text-sm text-muted-foreground">Growth not available.</p>
        ) : (
          <>
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Progression</h2>
              <p className="text-sm text-foreground">
                Stage: <span className="font-medium capitalize">{data.progression.stage?.replace('_', ' ') ?? 'not yet established'}</span>
                {data.progression.nextStage && <span className="text-muted-foreground"> · next: {data.progression.nextStage.replace('_', ' ')}</span>}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Verified stages: {data.progression.stagesReached.join(', ') || 'none'}</p>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Milestones</h2>
              {data.milestones.length === 0 ? <p className="text-sm text-muted-foreground">No milestones yet.</p> : (
                <ul className="space-y-1.5 text-sm">
                  {data.milestones.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="text-foreground">{m.title}</span>
                      <span className="text-xs text-muted-foreground">{m.type} · {m.decisionGrade ? 'source-backed' : 'self-reported'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Growth opportunities</h2>
              <ul className="space-y-1.5 text-sm">
                {data.growthGaps.map((g) => (
                  <li key={g.id}><span className="text-foreground">{g.title}</span> <span className="text-xs text-muted-foreground">— {g.rationale}</span></li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
