import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const AUTHENTICATED_MUTATION_ACTIONS = new Set(['accept', 'request-refresh', 'route-to-review', 'confirm-start']);
const PUBLIC_MUTATION_ACTIONS = new Set(['view']);
const PUBLIC_READ_ACTIONS = new Set(['acceptance-history']);
const AUTHENTICATED_READ_ACTIONS = new Set(['packet', 'status']);

function unauthorizedResponse() {
  return NextResponse.json(
    {
      error: 'unauthorized',
      error_description: 'Sign in with an employer workspace to continue.',
    },
    { status: 401 },
  );
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ entityId: string; action: string }> },
) {
  const { entityId, action } = await context.params;

  if (!AUTHENTICATED_MUTATION_ACTIONS.has(action) && !PUBLIC_MUTATION_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported employer-review action.' }, { status: 404 });
  }

  const requiresAuth = AUTHENTICATED_MUTATION_ACTIONS.has(action);
  const { userId } = await auth();
  if (requiresAuth && !userId) {
    return unauthorizedResponse();
  }

  const body = await req.text();
  const response = await fetch(`${BACKEND}/api/employer-review/${encodeURIComponent(entityId)}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(userId ? { 'x-clerk-user-id': userId } : {}),
    },
    body,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = typeof payload?.error === 'string' ? payload.error : 'Backend action failed';
    return NextResponse.json({ error: errorMsg }, { status: response.status });
  }

  return NextResponse.json(payload ?? {}, { status: response.status });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string; action: string }> },
) {
  const { entityId, action } = await context.params;

  if (!PUBLIC_READ_ACTIONS.has(action) && !AUTHENTICATED_READ_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported employer-review action.' }, { status: 404 });
  }

  const requiresAuth = AUTHENTICATED_READ_ACTIONS.has(action);
  const { userId } = await auth();
  if (requiresAuth && !userId) {
    return unauthorizedResponse();
  }

  let response: Response | null = null;
  try {
    response = await fetch(`${BACKEND}/api/employer-review/${encodeURIComponent(entityId)}/${action}`, {
      headers: {
        Accept: req.headers.get('accept') ?? 'application/json',
        ...(userId ? { 'x-clerk-user-id': userId } : {}),
      },
    });
  } catch {
    if (action === 'acceptance-history') {
      return NextResponse.json({ history: [], total: 0 }, { status: 200 });
    }
    return NextResponse.json({ error: 'Backend unreachable' }, { status: 502 });
  }

  const contentType = response.headers.get('content-type') ?? 'application/json';
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (action === 'acceptance-history') {
        return NextResponse.json({ history: [], total: 0 }, { status: 200 });
      }
      const errorMsg = typeof payload?.error === 'string' ? payload.error : 'Backend fetch failed';
      return NextResponse.json({ error: errorMsg }, { status: response.status });
    }
    return NextResponse.json(payload ?? {}, { status: response.status });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return new NextResponse(buffer, {
    status: response.status,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': response.headers.get('content-disposition') ?? 'attachment; filename="vitalcv-employer-packet.json"',
      'Content-Length': String(buffer.length),
    },
  });
}
