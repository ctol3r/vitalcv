/**
 * Wave 186 — Employer Knowledge Layer
 * Next.js proxy: GET /api/employers/:slug → backend
 */
import { NextRequest, NextResponse } from 'next/server';

import { BACKEND_URL as BACKEND } from '@/lib/backend-url';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  try {
    const res = await fetch(`${BACKEND}/api/employers/${encodeURIComponent(slug)}`, {
      headers: { 'Content-Type': 'application/json', 'x-org-id': 'vcv-system' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
