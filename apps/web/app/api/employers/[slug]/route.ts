/**
 * Wave 186 — Employer Knowledge Layer
 * Next.js proxy: GET /api/employers/:slug → backend
 */
import { NextRequest, NextResponse } from 'next/server';

const BACKEND = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:4000';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/employers/${encodeURIComponent(slug)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
