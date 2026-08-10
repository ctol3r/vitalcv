/**
 * GET /api/entities/[type]/[id]/relationships — bidirectional relationships.
 *
 * Returns { outgoing, backlinks } for a focus node, projected from real evidence
 * records (the same passport → evidence → graph chain /api/organizations uses).
 * Only `clinician` (id = NPI) is wired. `?focus=<nodeId>` centers a different node
 * (an evidence or source node) instead of the subject.
 *
 * PUBLIC AND UNAUTHENTICATED, so what it may return is governed by ADR 0006 and
 * enforced by `toPublicEvidenceCollection` — non-public evidence is removed BEFORE
 * projection, so its nodes and edges never exist and no `?focus=` value can reach
 * them. Do not move that call after the projection, and do not reach for the
 * unfiltered collection here: `entity-relationships-public-disclosure.test.ts`
 * fails if either happens. See lib/entity-relationships/public-disclosure.ts for
 * why the filter is node-level rather than the edge-type filter ADR 0006 first
 * described.
 *
 * Uniform 404 for any other type, a bad id, or any failure — never a 500 leak.
 */

import { NextRequest, NextResponse } from 'next/server';

import { projectEvidenceToGraph } from '@vitalcv/domain-evidence';

import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { projectEntityRelationships } from '@/lib/entity-relationships/project';
import { toPublicEvidenceCollection } from '@/lib/entity-relationships/public-disclosure';
import { resolvePassportRuntimePassport } from '@/lib/trust/passport-runtime';

export const runtime = 'nodejs';

const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;
const NOT_FOUND = NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });

const NPI_RE = /^\d{10}$/;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await context.params;

  // Only the clinician evidence graph is wired, and its id is a 10-digit NPI.
  if (type !== 'clinician' || !NPI_RE.test(id)) {
    return NOT_FOUND;
  }

  try {
    const passport = await resolvePassportRuntimePassport(id);
    // ADR 0006: reduce to publicly-disclosable evidence BEFORE projecting, so no
    // non-public node exists to be reached by ?focus= or by a surviving edge.
    const collection = toPublicEvidenceCollection(passportToEvidenceCollection(passport));
    const graph = projectEvidenceToGraph(collection);
    const focus = req.nextUrl.searchParams.get('focus') ?? undefined;
    const relationships = projectEntityRelationships(graph, focus);

    return NextResponse.json(
      { schema: 'vitalcv.entity-relationships.v1', type, id, ...relationships },
      { status: 200, headers: NO_STORE },
    );
  } catch {
    return NOT_FOUND;
  }
}
