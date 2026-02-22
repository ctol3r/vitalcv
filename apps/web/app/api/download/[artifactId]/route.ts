import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
          '';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ artifactId: string }> },
) {
  const { artifactId } = await params;

  if (!artifactId) {
    return NextResponse.json(
      { error: 'Missing artifactId' },
      { status: 400 },
    );
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/api/artifact/bundle/${encodeURIComponent(artifactId)}`,
      { cache: 'no-store' },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: res.status },
      );
    }

    const body = await res.json();

    return new NextResponse(JSON.stringify(body, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="artifact-${artifactId}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Download failed' },
      { status: 502 },
    );
  }
}
