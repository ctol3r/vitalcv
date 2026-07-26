import { NextRequest, NextResponse } from 'next/server';
import { buildKnowledgeGraph, indexKnowledgeGraph, traverseSubgraph } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

const MAX_DEPTH = 6;

/**
 * GET /api/knowledge-graph/[entityId]/subgraph?root=<id>&depth=<n>
 *   — bounded BFS traversal from a root entity (Wave 1100, C3/C6).
 *
 * Depth is clamped to [0, 6] so large-graph traversal can never explode; the
 * response reports `truncated` honestly when a bound was hit. Defaults: root =
 * the subject node, depth = 2.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const passport = await resolvePassportRuntimePassport(entityId);
    const collection = passportToEvidenceCollection(passport);
    const graph = buildKnowledgeGraph(collection);
    const index = indexKnowledgeGraph(graph);

    const { searchParams } = new URL(req.url);
    const root = searchParams.get('root') ?? graph.subjectId;
    const depthRaw = Number(searchParams.get('depth') ?? '2');
    const depth = Number.isFinite(depthRaw) ? Math.min(MAX_DEPTH, Math.max(0, Math.floor(depthRaw))) : 2;

    const subgraph = traverseSubgraph(index, root, depth);
    return NextResponse.json(
      { schema: 'vitalcv.knowledge-graph-subgraph.v1', subjectKey: graph.subjectKey, ...subgraph },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Subgraph traversal failed.';
    return NextResponse.json(
      { error: 'subgraph_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
