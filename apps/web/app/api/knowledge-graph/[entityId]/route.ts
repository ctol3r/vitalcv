import { NextRequest, NextResponse } from 'next/server';
import { buildKnowledgeGraph, searchEntities, type KnowledgeEntityKind } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

const ENTITY_KINDS = new Set<KnowledgeEntityKind>(['subject', 'evidence', 'source', 'organization']);

/**
 * GET /api/knowledge-graph/[entityId] — the canonical Professional Knowledge
 * Graph (Wave 1100, C4 projection + C5 search).
 *
 * Composes the evidence + organization projections into ONE typed graph. Optional
 * query params perform server-side search (C5):
 *   ?kind=organization   ?q=mayo   ?decisionGrade=1
 * Returns the full graph when no filters are present.
 *
 * Smart caching (C6): the graph's deterministic `contentHash` is returned as a
 * weak ETag; a matching `If-None-Match` yields 304. Body stays no-store so trust
 * data is never served stale.
 *
 * PUBLIC AND UNAUTHENTICATED, and NPI-keyed, so what it may return is governed by
 * ADR 0006 and enforced by `toPublicEvidenceCollection` — non-public evidence is
 * removed BEFORE `buildKnowledgeGraph`, which is the only placement that holds
 * here for three reasons: this projection publishes `evidenceClass` verbatim on
 * every entity; it overlays `projectOrganizations`, which derives organization
 * nodes from the SAME collection; and `?kind=`/`?q=` search the projected graph,
 * so anything left in it is directly queryable. See
 * `graph-routes-public-disclosure.test.ts`.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: reduce to publicly-disclosable evidence BEFORE projecting.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const graph = buildKnowledgeGraph(collection);

    const etag = `W/"${graph.contentHash}"`;
    if (req.headers.get('if-none-match') === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-store' } });
    }

    const { searchParams } = new URL(req.url);
    const kindParam = searchParams.get('kind');
    const q = searchParams.get('q') ?? undefined;
    const decisionGradeOnly = searchParams.get('decisionGrade') === '1';
    const hasFilter = Boolean(kindParam || q || decisionGradeOnly);

    if (hasFilter) {
      const kind = kindParam && ENTITY_KINDS.has(kindParam as KnowledgeEntityKind)
        ? (kindParam as KnowledgeEntityKind)
        : undefined;
      const results = searchEntities(graph, { kind, q, decisionGradeOnly });
      return NextResponse.json(
        { schema: 'vitalcv.knowledge-graph-search.v1', subjectKey: graph.subjectKey, query: { kind: kind ?? null, q: q ?? null, decisionGradeOnly }, results },
        { status: 200, headers: { ETag: etag, 'Cache-Control': 'no-store' } },
      );
    }

    return NextResponse.json(graph, { status: 200, headers: { ETag: etag, 'Cache-Control': 'no-store' } });
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[knowledge-graph/[entityId]]', error);
    const detail = 'Knowledge graph unavailable.';
    return NextResponse.json(
      { error: 'knowledge_graph_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
