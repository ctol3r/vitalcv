import { NextRequest, NextResponse } from 'next/server';
import { buildKnowledgeGraph, reason, type ReasoningQuery, type KnowledgeEntityKind } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';

export const runtime = 'nodejs';

const ENTITY_KINDS = new Set<KnowledgeEntityKind>(['subject', 'evidence', 'source', 'organization']);

/**
 * GET /api/reasoning/[entityId] — the Professional Reasoning Engine (Wave 1200,
 * C1/C4). Reasons over the canonical Knowledge Graph and returns a fully
 * explained answer: evidence, relationships, traversal path, and an honest
 * confidence (decision-grade coverage only — never inflated).
 *
 * Query params: ?root=<id> ?kind=<kind> ?q=<label> ?decisionGrade=1 ?depth=<n>
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

    const { searchParams } = new URL(req.url);
    const kindParam = searchParams.get('kind');
    const depthRaw = searchParams.get('depth');
    const query: ReasoningQuery = {
      root: searchParams.get('root') ?? undefined,
      kind: kindParam && ENTITY_KINDS.has(kindParam as KnowledgeEntityKind) ? (kindParam as KnowledgeEntityKind) : undefined,
      q: searchParams.get('q') ?? undefined,
      decisionGradeOnly: searchParams.get('decisionGrade') === '1',
      maxDepth: depthRaw !== null && Number.isFinite(Number(depthRaw)) ? Number(depthRaw) : undefined,
    };

    const result = reason(graph, query);
    return NextResponse.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Reasoning failed.';
    return NextResponse.json(
      { error: 'reasoning_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
