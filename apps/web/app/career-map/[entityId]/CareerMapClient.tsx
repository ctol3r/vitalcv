'use client';

/**
 * Career Map — the clinician's own career knowledge graph, drawn.
 *
 * Data is `/api/knowledge-graph/:entityId` (the canonical Professional Knowledge
 * Graph: subject + evidence + source + organization, with decision-grade flags).
 * It is projected from real passport evidence — there are no synthetic nodes on
 * this surface, and none may be added: a node here is a record that exists.
 *
 * This route is gated (see page.tsx): authenticated AND owned by the caller.
 *
 * ── Accessibility ───────────────────────────────────────────────────────────
 * The canvas is decorative-redundant, not load-bearing. Every node and edge it
 * draws is also rendered as text below it, so the surface is fully usable by a
 * screen reader and survives with JS-drawn SVG unavailable. Do not move
 * information into the canvas that does not also appear in the lists.
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { TrustGraphCanvas } from '@/components/graph/TrustGraphCanvas';
import type { GraphEdge, GraphNode } from '@/components/graph/types';
import { WorkspaceNav } from '@/components/workspace/WorkspaceNav';
import { fetchJson } from '@/lib/workspace/fetch-json';

interface KnowledgeEntity {
  id: string;
  kind: 'subject' | 'evidence' | 'source' | 'organization';
  label: string;
  decisionGrade: boolean;
  status: string | null;
  evidenceClass: string | null;
  trustScore: number | null;
  source: string | null;
}

interface KnowledgeEdge {
  id: string;
  from: string;
  to: string;
  predicate: string;
  decisionGrade: boolean;
  evidenceIds: string[];
}

interface KnowledgeGraphResponse {
  schema: string;
  subjectId: string;
  entities: KnowledgeEntity[];
  edges: KnowledgeEdge[];
  stats: {
    entityCount: number;
    edgeCount: number;
    decisionGradeEntityCount: number;
    byKind: Record<string, number>;
  };
}

/** Canvas group per knowledge-graph kind. `organization` merges into source. */
const GROUP_FOR_KIND: Record<KnowledgeEntity['kind'], string> = {
  subject: 'clinician',
  evidence: 'credential',
  source: 'issuer',
  organization: 'issuer',
};

const NODE_VALUE_FOR_KIND: Record<KnowledgeEntity['kind'], number> = {
  subject: 3,
  evidence: 1,
  source: 2,
  organization: 2,
};

/**
 * Collapse the organization overlay onto the source node it describes.
 *
 * `buildKnowledgeGraph` intends this — its comment says an org id "may coincide
 * with a source node id" and that the organization view wins. The ids never
 * actually coincide (`projectOrganizations` mints `org:<sourceId>` while the
 * evidence projection mints `source:<sourceId>`), so the merge never fires and
 * every source ships twice under the same label. Rather than change a shared
 * projection three other routes consume, this surface resolves the alias at
 * render time: `org:X` and `source:X` are one real-world thing, so they are
 * drawn as one node.
 */
function canonicalId(id: string): string {
  return id.startsWith('org:') ? `source:${id.slice('org:'.length)}` : id;
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ').toLowerCase();
}

function titleCase(value: string): string {
  const t = humanize(value);
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * The label to PAINT for a node.
 *
 * The projection labels an evidence object with its SOURCE's name, so
 * `coverage:nppes_identity` and `source:nppes_identity` both arrive as "nppes
 * identity" — the graph drew the same two words for two different things (the
 * fact, and where the fact came from) and read as duplicated. An evidence node
 * is better described by WHAT IT IS, which the projection already carries as
 * `evidenceClass`; the source keeps its own name. The edge between them already
 * says how they relate ("Has identity", "Verified by"), so nothing is lost.
 */
function nodeLabel(entity: KnowledgeEntity): string {
  if (entity.kind === 'evidence' && entity.evidenceClass) {
    return titleCase(entity.evidenceClass);
  }
  return entity.label;
}

export default function CareerMapClient({ entityId }: { entityId: string }) {
  const [graph, setGraph] = useState<KnowledgeGraphResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [focusClass, setFocusClass] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setFailed(false);
      const data = await fetchJson<KnowledgeGraphResponse>(
        `/api/knowledge-graph/${encodeURIComponent(entityId)}`,
      );
      if (cancelled) return;
      if (!data || !Array.isArray(data.entities)) {
        setFailed(true);
      } else {
        setGraph(data);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [entityId]);

  /** Entities after the org/source alias merge. Organization detail wins. */
  const entities = useMemo(() => {
    if (!graph) return [] as KnowledgeEntity[];
    const byId = new Map<string, KnowledgeEntity>();
    for (const e of graph.entities) {
      const id = canonicalId(e.id);
      const existing = byId.get(id);
      // The organization overlay is the more specific view of the same thing;
      // keep its trustScore/decisionGrade but never lose a label we already had.
      if (!existing || e.kind === 'organization') {
        byId.set(id, { ...e, id, label: e.label || existing?.label || id });
      }
    }
    return [...byId.values()];
  }, [graph]);

  const edges = useMemo(() => {
    if (!graph) return [] as KnowledgeEdge[];
    const byId = new Map<string, KnowledgeEdge>();
    for (const r of graph.edges) {
      const from = canonicalId(r.from);
      const to = canonicalId(r.to);
      if (from === to) continue; // self-edge created by the merge
      byId.set(`${r.predicate}:${from}->${to}`, { ...r, from, to });
    }
    return [...byId.values()];
  }, [graph]);

  const evidenceEntities = useMemo(
    () => entities.filter((e) => e.kind === 'evidence'),
    [entities],
  );

  const classes = useMemo(
    () => [...new Set(evidenceEntities.map((e) => e.evidenceClass).filter(Boolean))] as string[],
    [evidenceEntities],
  );

  /** Ids kept under the current class filter — subject and sources always stay. */
  const visibleIds = useMemo(() => {
    if (!focusClass) return new Set(entities.map((e) => e.id));
    const keptEvidence = new Set(
      evidenceEntities.filter((e) => e.evidenceClass === focusClass).map((e) => e.id),
    );
    const kept = new Set<string>(keptEvidence);
    for (const e of entities) {
      if (e.kind === 'subject') kept.add(e.id);
    }
    // Keep any source/org still reachable from the kept evidence.
    for (const r of edges) {
      if (keptEvidence.has(r.from)) kept.add(r.to);
      if (keptEvidence.has(r.to)) kept.add(r.from);
    }
    return kept;
  }, [focusClass, entities, evidenceEntities, edges]);

  const canvasNodes: GraphNode[] = useMemo(
    () =>
      entities
        .filter((e) => visibleIds.has(e.id))
        .map((e) => ({
          id: e.id,
          label: nodeLabel(e),
          group: GROUP_FOR_KIND[e.kind] ?? 'credential',
          status: e.status ?? undefined,
          val: NODE_VALUE_FOR_KIND[e.kind] ?? 1,
        })),
    [entities, visibleIds],
  );

  const canvasEdges: GraphEdge[] = useMemo(
    () =>
      edges
        .filter((r) => visibleIds.has(r.from) && visibleIds.has(r.to))
        .map((r) => ({
          source: r.from,
          target: r.to,
          label: humanize(r.predicate),
          type: r.predicate,
        })),
    [edges, visibleIds],
  );

  const active = activeNodeId ? entities.find((e) => e.id === activeNodeId) ?? null : null;
  const activeEdges = activeNodeId
    ? edges.filter((r) => r.from === activeNodeId || r.to === activeNodeId)
    : [];
  const labelOf = (id: string) => entities.find((e) => e.id === id)?.label ?? id;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-16">
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Loading career map…
        </p>
      </main>
    );
  }

  if (failed || !graph) {
    return (
      <main className="mx-auto w-full max-w-4xl px-4 py-16">
        <p className="text-sm text-muted-foreground">
          Career map not available right now. Nothing was removed from your record — this surface
          could not read it.
        </p>
      </main>
    );
  }

  const subject = entities.find((e) => e.kind === 'subject');

  return (
    <main className="min-h-screen bg-background">
      <WorkspaceNav entityId={entityId} active="career-map" />
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
        <header>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Career Map
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">
            {subject?.label ?? 'Clinician'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {entities.length} records · {edges.length} connections ·{' '}
            {entities.filter((e) => e.decisionGrade).length} decision-grade
            {' · '}
            <Link
              href={`/ecosystem/${encodeURIComponent(entityId)}`}
              className="hover:text-foreground"
            >
              ← Ecosystem
            </Link>
          </p>
        </header>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFocusClass(null)}
            aria-pressed={focusClass === null}
            className={`min-h-[44px] rounded-full border px-4 py-1 text-xs ${
              focusClass === null
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground'
            }`}
          >
            All evidence
          </button>
          {classes.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFocusClass(c)}
              aria-pressed={focusClass === c}
              className={`min-h-[44px] rounded-full border px-4 py-1 text-xs capitalize ${
                focusClass === c
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border text-muted-foreground'
              }`}
            >
              {humanize(c)}
            </button>
          ))}
        </div>

        {/*
          The drawn graph. Marked presentational: every node and edge below it is
          also listed as text, so a screen reader gets the whole graph without
          traversing an SVG that carries no semantics.
        */}
        <div aria-hidden="true">
          <TrustGraphCanvas
            nodes={canvasNodes}
            edges={canvasEdges}
            onNodeClick={(node) => setActiveNodeId((cur) => (cur === node.id ? null : node.id))}
            activeNodeId={activeNodeId}
            // ~9 nodes here. Without this the canvas labels only the subject and
            // whatever is hovered, so the clinician's own record reads as a
            // constellation of anonymous dots.
            showAllLabels
          />
        </div>

        {active && (
          <section className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{active.label}</h2>
                <p className="text-[11px] capitalize text-muted-foreground">
                  {active.kind}
                  {active.status ? ` · ${humanize(active.status)}` : ''}
                  {active.decisionGrade ? ' · decision-grade' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveNodeId(null)}
                className="min-h-[44px] rounded-full border border-border px-3 text-xs text-muted-foreground"
              >
                Clear
              </button>
            </div>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {activeEdges.map((r) => (
                <li key={r.id}>
                  {r.from === activeNodeId ? (
                    <>
                      <span className="capitalize">{humanize(r.predicate)}</span> →{' '}
                      <span className="text-foreground">{labelOf(r.to)}</span>
                    </>
                  ) : (
                    <>
                      <span className="text-foreground">{labelOf(r.from)}</span> →{' '}
                      <span className="capitalize">{humanize(r.predicate)}</span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Career map records" className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Evidence ({evidenceEntities.filter((e) => visibleIds.has(e.id)).length})
            </h2>
            <ul className="space-y-2">
              {evidenceEntities
                .filter((e) => visibleIds.has(e.id))
                .map((e) => (
                  <li key={e.id} className="rounded-xl border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground">{e.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {e.status ? humanize(e.status) : '—'}
                      </span>
                    </div>
                    <p className="text-[11px] capitalize text-muted-foreground">
                      {e.evidenceClass ? humanize(e.evidenceClass) : ''}
                      {e.decisionGrade ? ' · decision-grade' : ''}
                    </p>
                  </li>
                ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Sources &amp; organizations (
              {entities.filter((e) => e.kind !== 'subject' && e.kind !== 'evidence' && visibleIds.has(e.id)).length})
            </h2>
            <ul className="space-y-1.5">
              {entities
                .filter((e) => e.kind !== 'subject' && e.kind !== 'evidence' && visibleIds.has(e.id))
                .map((e) => (
                  <li
                    key={e.id}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-foreground"
                  >
                    {e.label}
                  </li>
                ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
