import { NextRequest, NextResponse } from 'next/server';
import { buildKnowledgeGraph, simulateScenario, type ScenarioMutation, type ReasoningQuery } from '@vitalcv/domain-evidence';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';
import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';

export const runtime = 'nodejs';

const MUTATION_TYPES = new Set<ScenarioMutation['type']>(['add_entity', 'add_edge', 'set_status']);

/**
 * POST /api/reasoning/[entityId]/simulate — scenario simulation (Wave 1200, C5).
 *
 * Body: `{ mutations: ScenarioMutation[], query?: ReasoningQuery }`.
 *
 * Applies hypothetical graph changes to a CLONE — source data is never mutated —
 * and reasons over the result. The response is always `hypothetical:true`;
 * simulated evidence is never decision-grade, so a scenario can never be
 * presented as real verification.
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ entityId: string }> },
) {
  const { entityId } = await context.params;
  try {
    const body = (await req.json().catch(() => null)) as
      | { mutations?: unknown; query?: ReasoningQuery }
      | null;

    const mutations = Array.isArray(body?.mutations) ? (body!.mutations as ScenarioMutation[]) : [];
    // Validate mutation shape (only known types).
    if (!mutations.every((m) => m && typeof m === 'object' && MUTATION_TYPES.has((m as ScenarioMutation).type))) {
      return NextResponse.json(
        { error: 'invalid_request', error_description: 'mutations must be an array of {type: add_entity|add_edge|set_status}.' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } },
      );
    }

    const passport = await resolvePassportRuntimePassport(entityId);
    // ADR 0006: public, NPI-keyed — reduce to publicly-disclosable evidence BEFORE
    // projecting, so a non-public node never exists. See graph-routes-public-disclosure.test.ts.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const graph = buildKnowledgeGraph(collection);

    const scenario = simulateScenario(graph, mutations, body?.query ?? {});
    return NextResponse.json(
      { schema: 'vitalcv.reasoning-scenario.v1', subjectKey: graph.subjectKey, ...scenario },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    // Never echo an internal error message to the caller: it is the only
    // caller-visible difference between failure causes on an otherwise uniform
    // response. Log it server-side; return the static description.
    console.error('[reasoning/[entityId]/simulate]', error);
    const detail = 'Scenario simulation failed.';
    return NextResponse.json(
      { error: 'simulation_unavailable', error_description: detail },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
