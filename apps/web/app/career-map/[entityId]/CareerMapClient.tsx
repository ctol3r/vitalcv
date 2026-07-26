'use client';

/**
 * Career Map (Wave 300, D2) — a navigable map of the clinician's career graph:
 * Clinician ↔ Evidence ↔ Source/Organization, with trust. Interactive: select an
 * evidence class to focus its evidence and the sources/relationships behind it.
 * Read-only; status and trust are verbatim from the graph/trust layers.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { GraphProjection, TrustProjection } from '@vitalcv/domain-evidence';
import { fetchJson } from '@/lib/workspace/fetch-json';
import { WorkspaceNav } from '@/components/workspace/WorkspaceNav';

export default function CareerMapClient({ entityId }: { entityId: string }) {
  const [graph, setGraph] = useState<GraphProjection | null>(null);
  const [trust, setTrust] = useState<TrustProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [focusClass, setFocusClass] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const id = encodeURIComponent(entityId);
      const [g, t] = await Promise.all([
        fetchJson<GraphProjection>(`/api/graph/${id}`),
        fetchJson<TrustProjection>(`/api/graph/${id}/trust`),
      ]);
      if (cancelled) return;
      setGraph(g); setTrust(t); setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [entityId]);

  const evidenceNodes = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === 'evidence'), [graph]);
  const sourceNodes = useMemo(() => (graph?.nodes ?? []).filter((n) => n.type === 'source'), [graph]);
  const classes = useMemo(() => [...new Set(evidenceNodes.map((n) => n.evidenceClass).filter(Boolean))] as string[], [evidenceNodes]);

  if (loading) return <main className="mx-auto w-full max-w-4xl px-4 py-16"><p role="status" aria-live="polite" className="text-sm text-muted-foreground">Loading career map…</p></main>;
  if (!graph) return <main className="mx-auto w-full max-w-4xl px-4 py-16"><p className="text-sm text-muted-foreground">Career map not available.</p></main>;

  const subject = graph.nodes.find((n) => n.type === 'subject');
  const shown = focusClass ? evidenceNodes.filter((n) => n.evidenceClass === focusClass) : evidenceNodes;
  const shownEvidenceIds = new Set(shown.map((n) => n.id));
  const relevantSources = sourceNodes.filter((s) =>
    graph.relationships.some((r) => shownEvidenceIds.has(r.from) && r.to === s.id),
  );
  const sourceFor = (evId: string) => graph.relationships.find((r) => r.from === evId && r.to.startsWith('source:'))?.to ?? null;
  const labelOf = (nodeId: string) => graph.nodes.find((n) => n.id === nodeId)?.label ?? nodeId;

  return (
    <main className="min-h-screen bg-background">
      <WorkspaceNav entityId={entityId} active="career-map" />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Career Map</p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{subject?.label ?? 'Clinician'}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {graph.stats.nodeCount} nodes · {graph.stats.relationshipCount} connections · {graph.stats.decisionGradeNodeCount} decision-grade
            {' · '}<Link href={`/ecosystem/${encodeURIComponent(entityId)}`} className="hover:text-foreground">← Ecosystem</Link>
          </p>
        </header>

        {/* Class filter */}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setFocusClass(null)}
            className={`rounded-full border px-3 py-1 text-xs ${focusClass === null ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`}>
            All evidence
          </button>
          {classes.map((c) => (
            <button key={c} type="button" onClick={() => setFocusClass(c)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${focusClass === c ? 'border-foreground bg-foreground text-background' : 'border-border text-muted-foreground'}`}>
              {c.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        {/* Map: three columns — clinician | evidence | sources */}
        <div className="grid gap-4 md:grid-cols-[1fr_1.4fr_1fr]">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Clinician</h2>
            <p className="text-sm font-medium text-foreground">{subject?.label ?? 'Clinician'}</p>
            {trust && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {trust.dimensions.filter((d) => d.score !== null && d.score > 0).map((d) => (
                  <li key={d.dimension} className="flex justify-between"><span className="capitalize">{d.dimension}</span><span>{d.score}</span></li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence ({shown.length})</h2>
            <ul className="space-y-2">
              {shown.map((n) => (
                <li key={n.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-foreground">{n.label}</span>
                    <span className="text-[11px] text-muted-foreground">{n.status ?? '—'}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    <span className="capitalize">{n.evidenceClass?.replace(/_/g, ' ')}</span>
                    {sourceFor(n.id) ? ` → ${labelOf(sourceFor(n.id)!)}` : ''}
                    {n.decisionGrade ? ' · decision-grade' : ''}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources & Orgs ({relevantSources.length})</h2>
            <ul className="space-y-1.5">
              {relevantSources.map((s) => (
                <li key={s.id} className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground">{s.label}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
