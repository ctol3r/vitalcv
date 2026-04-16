import { type NextRequest } from 'next/server';
import { respondOk, respondFail, sanitize, explainBackend } from '@/lib/api-envelope';

export const runtime = 'nodejs';

const BACKEND_URL =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(req: NextRequest) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/decisions${req.nextUrl.search}`);
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return respondFail(explainBackend(res.status), res.status);
    }
    return respondOk(sanitize(raw));
  } catch (err) {
    console.error('[api/decisions GET] backend unreachable', err);
    return respondFail('The system is temporarily unavailable. Please retry.', 502);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const res = await fetch(`${BACKEND_URL}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const raw = await res.json().catch(() => ({}));
    if (!res.ok) {
      return respondFail(explainBackend(res.status), res.status);
    }
    return respondOk(sanitize(raw), 'Decision capsule created', 201);
  } catch (err) {
    console.error('[api/decisions POST] backend unreachable', err);
    return respondFail('The system is temporarily unavailable. Please retry.', 502);
  }
}
