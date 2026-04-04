/**
 * Wave 186 — Employer Knowledge Layer
 * Next.js proxy: GET /api/employers/compare?slugs=a,b → backend
 */
import { NextRequest, NextResponse } from 'next/server';

import { BACKEND_URL as BACKEND } from '@/lib/backend-url';

export async function GET(req: NextRequest) {
  const slugs = req.nextUrl.searchParams.get('slugs') ?? '';
  try {
    const res = await fetch(`${BACKEND}/api/employers/compare?slugs=${encodeURIComponent(slugs)}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
