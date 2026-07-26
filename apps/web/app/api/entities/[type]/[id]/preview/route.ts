/**
 * GET /api/entities/[type]/[id]/preview — the authorization-safe preview facade.
 *
 * Small payload, private/no-store, uniform 404 for absent OR unauthorized OR
 * unknown-type (anti-enumeration: a preview never confirms an entity's existence
 * to someone who may not open it). Authorization is enforced by the underlying
 * per-type resolver's reuse of the entity's own authorized data path.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

import { resolveEntityPreview } from '@/lib/entity-preview/resolvers';
import { isPreviewableType } from '@/lib/entity-preview/types';

export const runtime = 'nodejs';

const NOT_FOUND = { error: 'not_found' } as const;
const NO_STORE = { 'Cache-Control': 'private, no-store' } as const;

export async function GET(
  _req: Request,
  context: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await context.params;

  if (!isPreviewableType(type) || !id) {
    return NextResponse.json(NOT_FOUND, { status: 404, headers: NO_STORE });
  }

  // Any failure — session resolution, resolver, backend — collapses to the same
  // 404 as "absent" or "unauthorized". A preview must never 500-leak, and never
  // let the outcome distinguish "exists but you can't see it" from "not found".
  try {
    const session = await auth();
    const preview = await resolveEntityPreview(type, id, session);
    if (!preview) {
      return NextResponse.json(NOT_FOUND, { status: 404, headers: NO_STORE });
    }
    return NextResponse.json(preview, { status: 200, headers: NO_STORE });
  } catch {
    return NextResponse.json(NOT_FOUND, { status: 404, headers: NO_STORE });
  }
}
