/**
 * Wave 186 — Employer Knowledge Layer
 * Next.js proxy: GET /api/employers → backend
 */
import { NextRequest, NextResponse } from 'next/server';

import { BACKEND_URL as BACKEND } from '@/lib/backend-url';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const qs = searchParams.toString();
  const url = `${BACKEND}/api/employers${qs ? `?${qs}` : ''}`;
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json', 'x-org-id': 'vcv-system' } });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
  }
}
