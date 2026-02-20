import { NextRequest, NextResponse } from 'next/server';

/**
 * Demo API proxy — forwards /api/demo/* to the backend API.
 *
 * Keeps the backend URL private and avoids CORS issues.
 * Follows same pattern as apps/marketing/app/api/npi/[npi]/route.ts.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

async function proxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const downstream = path.join('/');
  const url = new URL(req.url);
  const qs = url.search; // preserve query string

  if (!API_BASE) {
    return NextResponse.json(
      { error: 'API not configured' },
      { status: 503 },
    );
  }

  const target = `${API_BASE}/demo/${downstream}${qs}`;

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Forward content-type for POST/PUT
    const ct = req.headers.get('content-type');
    if (ct) headers['Content-Type'] = ct;

    const res = await fetch(target, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD'
        ? await req.text()
        : undefined,
    });

    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: {
        'Content-Type': res.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Backend unreachable' },
      { status: 502 },
    );
  }
}

export const GET = proxy;
export const POST = proxy;
