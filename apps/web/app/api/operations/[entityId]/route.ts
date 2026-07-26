import { NextRequest, NextResponse } from 'next/server';
import { composeCareerModel, buildKnowledgeGraph, reason } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { deriveTasks } from '@/lib/operations/tasks';
import { recordOperationalEvents } from '@/lib/operations/events';
import { projectWorklist, buildActivityFeed } from '@/lib/operations/projections';

export const runtime = 'nodejs';

/**
 * GET /api/operations/[entityId] — the Healthcare Operations snapshot (Wave 1400,
 * C4/C5). Resolves the canonical Career Model ONCE, derives the fact-based task
 * worklist, records operational events, and builds the activity feed. Also
 * surfaces the Reasoning Engine's honest confidence as operational context
 * (decision-grade coverage), reusing the existing engine — no new logic.
 *
 * `?at=<ISO>` injects the event timestamp for determinism; defaults to now.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const { searchParams } = new URL(req.url);
    const at = searchParams.get('at')?.trim() || new Date().toISOString();

    const passport = await resolvePassportRuntimePassport(entityId);
    const model = composeCareerModel(passportToEvidenceCollection(passport));

    const tasks = deriveTasks(model);
    const events = recordOperationalEvents(tasks, at);
    const worklist = projectWorklist(model.identity.subjectKey, tasks);
    const activity = buildActivityFeed(events);

    // Reasoning Engine reuse: honest decision-grade confidence as ops context.
    const reasoning = reason(buildKnowledgeGraph(model.evidence), { maxDepth: 3 });

    return NextResponse.json(
      {
        schema: 'vitalcv.operations.v1',
        subjectKey: model.identity.subjectKey,
        worklist,
        activity,
        context: {
          readiness: model.readiness.readiness,
          decisionGradeEvidence: model.meta.decisionGradeEvidence,
          totalEvidence: model.meta.totalEvidence,
          confidence: reasoning.explanation.confidence,
        },
      },
      { status: 200, headers: { ETag: `W/"${model.meta.contentHash}"`, 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Operations snapshot failed.';
    return NextResponse.json(
      { error: 'operations_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
