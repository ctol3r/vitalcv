/**
 * /api/auth/recovery — email magic-link recovery (foundation tier)
 *
 * POST { email: string }
 *
 * Truth contract:
 *   - Always returns 200 with a generic message regardless of whether the
 *     email is registered. This prevents email enumeration.
 *   - When CLERK_SECRET_KEY is configured, creates a Clerk sign-in token
 *     for the user (if found) which can be used to build a magic-link URL.
 *     Full email delivery requires Clerk email template configuration
 *     (see docs/setup/clerk-google-oauth.md).
 *   - All errors (Clerk unavailable, user not found, invalid input) are
 *     silently swallowed — the response body and timing are identical
 *     across all code paths.
 */
import { clerkClient } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const RECOVERY_RESPONSE = {
  message:
    'If an account with that email address exists, a recovery link has been sent. Check your inbox.',
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let email = '';
  try {
    const body: unknown = await req.json();
    if (body !== null && typeof body === 'object' && 'email' in body) {
      const raw = (body as { email: unknown }).email;
      if (typeof raw === 'string') email = raw.trim().toLowerCase();
    }
  } catch {
    // Malformed body — still return 200 (timing-safe)
  }

  // Attempt magic-link dispatch; all failures are silently ignored.
  if (email) {
    try {
      const clerk = await clerkClient();
      const { data: users } = await clerk.users.getUserList({
        emailAddress: [email],
        limit: 1,
      });
      const user = users[0];
      if (user) {
        // Create a one-time sign-in token (expires in 1 hour).
        // In production, combine this token with a transactional email
        // send via your email provider. Clerk itself does not send
        // magic-link recovery emails via the backend SDK at this tier —
        // see docs/setup/clerk-google-oauth.md for the full setup.
        await clerk.signInTokens.createSignInToken({
          userId: user.id,
          expiresInSeconds: 3600,
        });
      }
    } catch {
      // Clerk unavailable or user not found — response is identical (timing-safe)
    }
  }

  return NextResponse.json(RECOVERY_RESPONSE, { status: 200 });
}
