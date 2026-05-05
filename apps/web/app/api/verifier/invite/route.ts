/**
 * /api/verifier/invite — POST creates a verifier team invitation.
 *
 * Auth: requires Clerk user + org_id claim (read by middleware RBAC).
 *
 * Body: { email: string; role: 'admin' | 'reviewer' | 'read_only' }
 *
 * Response: 201 with { invitation, shareableUrl, emailSendChannel, invitationSystemLive: true }
 */
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { createInvitation } from '@/lib/auth/invitationRepo';
import { validateCreateInput } from '@/lib/auth/invitationLifecycle';

export const runtime = 'nodejs';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Sign in to send invitations.' },
      { status: 401 },
    );
  }

  const claims = sessionClaims?.vitalcv as Record<string, unknown> | undefined;
  const orgId = typeof claims?.org_id === 'string' ? claims.org_id : null;
  if (!orgId) {
    return NextResponse.json(
      { error: 'no_org_context', message: 'Active org membership required to invite.' },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_request', message: 'Expected JSON body.' },
      { status: 400 },
    );
  }
  const { email, role } = (body ?? {}) as { email?: unknown; role?: unknown };

  const validation = validateCreateInput({
    email,
    role,
    orgId,
    invitedByUserId: userId,
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.reason, message: 'Email and role are required; role must be admin, reviewer, or read_only.' },
      { status: 400 },
    );
  }

  const baseUrl = req.nextUrl.origin;
  const result = await createInvitation({
    email: email as string,
    role: role as 'admin' | 'reviewer' | 'read_only',
    orgId,
    invitedByUserId: userId,
    baseUrl,
  });

  return NextResponse.json(
    {
      invitation: {
        invitationCode: result.invitation.invitationCode,
        email: result.invitation.email,
        role: result.invitation.role,
        orgId: result.invitation.orgId,
        status: result.invitation.status,
        expiresAt: result.invitation.expiresAt.toISOString(),
        createdAt: result.invitation.createdAt.toISOString(),
      },
      shareableUrl: result.shareableUrl,
      emailSendChannel: result.emailSendChannel,
      invitationSystemLive: result.invitationSystemLive,
    },
    { status: 201 },
  );
}
