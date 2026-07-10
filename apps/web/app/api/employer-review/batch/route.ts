/**
 * POST /api/employer-review/batch — Wave L.
 *
 * Applies one review decision (accept-as-head-start / request-refresh /
 * route-to-review) across a selected set of candidates. The backend runs the
 * full single-entity semantics per candidate — RBAC, duplicate guard, BLOCKED
 * fail-closed check, one AuditEvent per candidate — and reports per-candidate
 * outcomes. The body is sanitized to the known batch fields before forwarding;
 * bundleId is intentionally not forwardable (per-clinician attribution).
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { buildIdentityHeaders } from '@/lib/auth/forwardIdentity';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const BATCH_ACTIONS = new Set(['accept', 'request-refresh', 'route-to-review']);
const MAX_BATCH = 25;

const STRING_FIELDS = [
  'role',
  'facility',
  'notes',
  'acceptanceScope',
  'acceptanceReason',
  'message',
  'reason',
  'priority',
  'organizationContextId',
] as const;

const STRING_LIST_FIELDS = ['staleSources', 'missingDomains'] as const;

function sanitizeBatchBody(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;

  if (typeof body.action !== 'string' || !BATCH_ACTIONS.has(body.action)) return null;
  if (!Array.isArray(body.entityIds) || body.entityIds.length === 0) return null;

  const entityIds = body.entityIds
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim());
  if (entityIds.length === 0) return null;
  // Reject oversized batches outright — silently truncating a selection would
  // drop decisions the employer believes they made.
  if (entityIds.length > MAX_BATCH) return null;

  const sanitized: Record<string, unknown> = { action: body.action, entityIds };

  for (const field of STRING_FIELDS) {
    const value = body[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      sanitized[field] = value.trim().slice(0, 2000);
    }
  }
  for (const field of STRING_LIST_FIELDS) {
    const value = body[field];
    if (Array.isArray(value)) {
      const list = value
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => v.trim().slice(0, 200))
        .slice(0, 25);
      if (list.length > 0) sanitized[field] = list;
    }
  }

  return sanitized;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request', error_description: 'Body must be valid JSON.' }, { status: 400 });
  }

  const sanitized = sanitizeBatchBody(raw);
  if (!sanitized) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Malformed batch request body.' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${BACKEND}/api/employer-review/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(await buildIdentityHeaders({ userId })),
      },
      body: JSON.stringify(sanitized),
      cache: 'no-store',
      // Batches run the full per-candidate gate sequence — allow more time
      // than the single-entity proxy.
      signal: AbortSignal.timeout(60_000),
    });
    const payload = await response.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[employer-review/batch proxy]', error);
    return NextResponse.json(
      { error: 'backend_unavailable', error_description: 'Employer review backend is unavailable.' },
      { status: 503 },
    );
  }
}
