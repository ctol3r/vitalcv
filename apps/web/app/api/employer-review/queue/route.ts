/**
 * GET /api/employer-review/queue — Wave L.
 *
 * The signed-in employer's review inbox: clinicians who shared an apply
 * bundle with the employer's own registered organization. The backend binds
 * the scope server-side to the caller's org profile — no caller-supplied
 * organizationId is honored, so this proxy forwards identity (Clerk user id)
 * and the row limit only.
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const BACKEND =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam && /^\d{1,2}$/.test(limitParam) ? `?limit=${limitParam}` : '';

  try {
    const response = await fetch(`${BACKEND}/api/employer-review/queue${limit}`, {
      headers: {
        Accept: 'application/json',
        'x-clerk-user-id': userId,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({ error: 'Invalid response from backend' }));
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    console.error('[employer-review/queue proxy]', error);
    return NextResponse.json(
      { error: 'backend_unavailable', error_description: 'Employer review backend is unavailable.' },
      { status: 503 },
    );
  }
}
