/**
 * clerkInvitationSender.ts
 *
 * Wraps Clerk's invitations API for sending verifier invitations as
 * magic-link emails. Best-effort — if CLERK_SECRET_KEY is absent or
 * the Clerk call fails, returns 'shareable_url_only' so the caller
 * can still hand the user a copyable URL.
 *
 * Truth contracts:
 *   - This codebase NEVER sends email via SMTP, nodemailer, or any
 *     other direct mailer. Clerk's hosted invitation email is the only
 *     transport. Keep this file the single mention of email send paths.
 */
import 'server-only';
import type { EmailSendChannel } from './invitationLifecycle';

export interface ClerkSendInput {
  email: string;
  redirectUrl: string;
  invitationCode: string;
}

export async function sendInvitationViaClerk(
  input: ClerkSendInput,
): Promise<EmailSendChannel> {
  if (!process.env.CLERK_SECRET_KEY) {
    return 'shareable_url_only';
  }
  try {
    const { clerkClient } = await import('@clerk/nextjs/server');
    const client = await clerkClient();
    await client.invitations.createInvitation({
      emailAddress: input.email,
      redirectUrl: input.redirectUrl,
      publicMetadata: { vitalcv_invitation_code: input.invitationCode },
    });
    return 'clerk_magic_link';
  } catch {
    return 'shareable_url_only';
  }
}
