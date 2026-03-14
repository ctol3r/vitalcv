import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ npi: string }> },
) {
  const { npi } = await params;
  const qs = req.nextUrl.searchParams.toString();
  const upstream = await fetch(
    `${API_BASE}/api/verify-professional/${npi}${qs ? '?' + qs : ''}`,
  );
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
