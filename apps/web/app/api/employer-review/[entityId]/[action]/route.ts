import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

const MUTATION_ACTIONS = new Set(['accept', 'request-refresh', 'route-to-review']);

function extractProxyError(payload: unknown, fallback: string): {
  error: string;
  error_code?: string;
} {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as {
      error?: unknown;
      error_description?: unknown;
    };

    if (typeof record.error_description === 'string' && record.error_description.trim().length > 0) {
      return { error: record.error_description };
    }

    if (typeof record.error === 'string' && record.error.trim().length > 0) {
      return { error: record.error };
    }

    if (typeof record.error === 'object' && record.error !== null) {
      const structured = record.error as {
        code?: unknown;
        message?: unknown;
      };

      if (typeof structured.message === 'string' && structured.message.trim().length > 0) {
        return {
          error: structured.message,
          ...(typeof structured.code === 'string' ? { error_code: structured.code } : {}),
        };
      }
    }
  }

  return { error: fallback };
}

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

  if (!MUTATION_ACTIONS.has(action)) {
    return NextResponse.json({ error: 'Unsupported employer-review action.' }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return unauthorizedResponse();
  }

  const body = await req.text();
  const response = await fetch(`${BACKEND}/api/employer-review/${encodeURIComponent(entityId)}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-clerk-user-id': userId,
    },
    body,
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(
      extractProxyError(payload, 'Backend action failed'),
      { status: response.status },
    );
  }

  return NextResponse.json(payload ?? {}, { status: response.status });
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ entityId: string; action: string }> },
) {
  const { entityId, action } = await context.params;

  if (action !== 'packet' && action !== 'status') {
    return NextResponse.json({ error: 'Unsupported employer-review action.' }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return unauthorizedResponse();
  }

  const response = await fetch(`${BACKEND}/api/employer-review/${encodeURIComponent(entityId)}/${action}`, {
    headers: {
      Accept: req.headers.get('accept') ?? 'application/json',
      'x-clerk-user-id': userId,
    },
  });

  const contentType = response.headers.get('content-type') ?? 'application/json';
  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      return NextResponse.json(
        extractProxyError(payload, 'Backend fetch failed'),
        { status: response.status },
      );
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
