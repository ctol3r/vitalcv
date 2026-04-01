import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { humanizePublicErrorMessage } from '@/lib/live-path/contracts';
export const runtime = 'nodejs';
const B = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_BASE || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({
      error: 'sign_in_required',
      error_description: 'Sign in required to continue',
      message: 'Sign in required to continue',
    }, { status: 401 });
  }

  const payload = await req.json().catch(() => ({})) as {
    entityId?: unknown;
    organizationContextId?: unknown;
  };
  if (typeof payload.organizationContextId !== 'string' || payload.organizationContextId.trim().length === 0) {
    return NextResponse.json({
      error: 'employer_context_required',
      error_description: 'Employer context required',
      message: 'Employer context required',
    }, { status: 400 });
  }

  const res = await fetch(`${B}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-clerk-user-id': userId },
    body: JSON.stringify(payload),
  });
  const forwarded = await res.json().catch(() => ({})) as {
    error?: string;
    error_description?: string;
    message?: string;
    expiresAt?: string | null;
  };

  if (res.status === 401) {
    return NextResponse.json({
      error: 'sign_in_required',
      error_description: 'Sign in required to continue',
      message: 'Sign in required to continue',
    }, { status: 401 });
  }

  if (
    res.status === 400
    && (
      forwarded.error === 'organization_context_required'
      || forwarded.error_description?.toLowerCase().includes('organization context')
    )
  ) {
    return NextResponse.json({
      error: 'employer_context_required',
      error_description: 'Employer context required',
      message: 'Employer context required',
    }, { status: 400 });
  }

  if (!res.ok) {
    const message = humanizePublicErrorMessage(
      forwarded.error_description ?? forwarded.error ?? forwarded.message,
      'Share is unavailable right now. Try again in a moment.',
    );

    return NextResponse.json({
      error: forwarded.error ?? 'share_unavailable',
      error_description: message,
      message,
    }, { status: res.status });
  }

  return NextResponse.json({
    ...forwarded,
    expiresAt: forwarded.expiresAt ?? null,
  }, { status: res.status });
}
