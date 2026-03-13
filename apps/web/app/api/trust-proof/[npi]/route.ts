import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ npi: string }> },
) {
  const { npi } = await context.params;
  const upstreamUrl = new URL(`${BACKEND}/api/trust-proof/${encodeURIComponent(npi)}`);

  for (const [key, value] of req.nextUrl.searchParams.entries()) {
    upstreamUrl.searchParams.set(key, value);
  }

  try {
    const res = await fetch(upstreamUrl.toString(), {
      headers: { Accept: req.headers.get('accept') ?? 'application/json' },
    });

    if ((req.nextUrl.searchParams.get('format') ?? '').toLowerCase() === 'pdf') {
      const buffer = Buffer.from(await res.arrayBuffer());
      return new NextResponse(buffer, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('content-type') ?? 'application/pdf',
          'Content-Disposition': res.headers.get('content-disposition') ?? `attachment; filename="trust-proof-${npi}.pdf"`,
          'Content-Length': String(buffer.length),
        },
      });
    }

    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch trust proof' }, { status: 502 });
  }
}
