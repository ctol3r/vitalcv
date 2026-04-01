/**
 * Wave 246: Apply-with-VitalCV — POST /api/apply/bundle proxy
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { humanizePublicErrorMessage } from '@/lib/live-path/contracts';
export const runtime = 'nodejs';

const B =
  process.env.BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_BASE ||
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  'http://localhost:4000';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({
      error: 'sign_in_required',
      error_description: 'Sign in required to continue',
      message: 'Sign in required to continue',
    }, { status: 401 });
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  headers['x-clerk-user-id'] = userId;
  const body = await req.text();
  const res = await fetch(`${B}/api/apply/bundle`, {
    method: 'POST',
    headers,
    body,
  });
  const payload = await res.json().catch(() => ({})) as {
    error?: string;
    error_description?: string;
    message?: string;
    bundleId?: string;
    bundleUrl?: string;
    expiresAt?: string | null;
  };

  if (res.status === 401) {
    return NextResponse.json({
      error: 'sign_in_required',
      error_description: 'Sign in required to continue',
      message: 'Sign in required to continue',
    }, { status: 401 });
  }

  if (!res.ok) {
    const message = humanizePublicErrorMessage(
      payload.error_description ?? payload.error ?? payload.message,
      'Could not generate a share link right now.',
    );

    return NextResponse.json({
      error: payload.error ?? 'share_link_unavailable',
      error_description: message,
      message,
    }, { status: res.status });
  }

  return NextResponse.json({
    bundleId: payload.bundleId,
    bundleUrl: payload.bundleUrl,
    expiresAt: payload.expiresAt ?? null,
  }, { status: res.status });
}
