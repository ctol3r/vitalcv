/**
 * GET /api/entities/[type]/[id]/relationships — bidirectional relationships.
 *
 * Returns { outgoing, backlinks } for a focus node, projected from real evidence
 * records (the same passport → evidence → graph chain /api/organizations uses).
 * Only `clinician` (id = NPI) is wired: its relationships are the clinician's
 * own evidence graph, which is already public via /verify/:npi and /api/evidence,
 * so this adds no new authorization surface. `?focus=<nodeId>` centers a
 * different node (an evidence or source node) instead of the subject.
 *
 * Uniform 404 for any other type, a bad id, or any failure — never a 500 leak.
 */

import { NextRequest, NextResponse } from 'next/server';

import { projectEvidenceToGraph } from '@vitalcv/domain-evidence';

import { passportToEvidenceCollection } from '@/lib/evidence/passport-to-evidence';
import { projectEntityRelationships } from '@/lib/entity-relationships/project';
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
    const collection = passportToEvidenceCollection(passport);
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
