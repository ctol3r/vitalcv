/**
 * GET /api/snapshot/[id] — Wave M. Public proxy for the persisted readiness
 * snapshot reuse route. Serves any reviewer holding the capability id; the
 * backend writes an AuditEvent for every access and fails closed on revoked
 * snapshots. No auth is required — possession of the id IS the grant, same
 * posture as the apply bundle link.
 */
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'snapshot_not_found' }, { status: 404 });
  }

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    const orgId = req.headers.get('x-org-id')?.trim();
    if (orgId) headers['x-org-id'] = orgId;

    const response = await fetch(`${BACKEND}/api/snapshot/${id}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[snapshot proxy]', error);
    return NextResponse.json(
      { error: 'backend_unavailable', error_description: 'Snapshot service is unavailable.' },
      { status: 503 },
    );
  }
}
