/**
 * invitationLifecycle.ts
 *
 * Pure lifecycle logic for verifier invitations. No DB, no Clerk, no I/O.
 * The repo layer wraps these helpers around real Prisma reads/writes.
 *
 * Truth contracts:
 *   - invitationSystemLive: true (literal) — system is no longer foundation-only.
 *   - Status transitions are one-way: pending → {accepted, expired, revoked}.
 *     Once terminal, the row is never re-opened.
 *   - Accept-acceptance idempotency: a second accept attempt on an
 *     already-accepted invitation returns 409 with the original acceptedAt
 *     preserved — it does NOT update acceptedAt.
 *   - Email transport is Clerk magic-link only. No SMTP, no nodemailer.
 */

import type { OrgRole } from '@/lib/verifier/orgRolesFoundation';

export const invitationSystemLive = true as const;

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export type EmailSendChannel = 'clerk_magic_link' | 'shareable_url_only';

export const ALLOWED_EMAIL_CHANNELS: ReadonlyArray<EmailSendChannel> = [
  'clerk_magic_link',
  'shareable_url_only',
] as const;

export interface VerifierInvitationRow {
  id: string;
  invitationCode: string;
  email: string;
  role: OrgRole;
  orgId: string;
  invitedByUserId: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  emailSendChannel: EmailSendChannel;
  createdAt: Date;
}

export type AcceptDecision =
  | { ok: true; transitionTo: 'accepted' }
  | { ok: false; statusCode: 404 | 409 | 410; reason: AcceptRefusalReason };

export type AcceptRefusalReason =
  | 'invitation_not_found'
  | 'invitation_expired'
  | 'invitation_already_accepted'
  | 'invitation_revoked';

/**
 * Pure decision: should this invitation be accepted now?
 *
 * Returns a structured outcome. Repo callers map ok=false statusCode
 * directly to the HTTP response status (404 / 409 / 410).
 *
 * Order of gates:
 *   1. Row missing      → 404
 *   2. Already accepted → 409 (idempotent — original acceptedAt is kept)
 *   3. Revoked          → 410 (treat as gone)
 *   4. Expired by time  → 410
 *   5. Permitted        → ok
 */
export function decideAccept(
  row: VerifierInvitationRow | null,
  now: Date,
): AcceptDecision {
  if (!row) {
    return { ok: false, statusCode: 404, reason: 'invitation_not_found' };
  }
  if (row.status === 'accepted') {
    return { ok: false, statusCode: 409, reason: 'invitation_already_accepted' };
  }
  if (row.status === 'revoked') {
    return { ok: false, statusCode: 410, reason: 'invitation_revoked' };
  }
  if (row.status === 'expired' || row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, statusCode: 410, reason: 'invitation_expired' };
  }
  return { ok: true, transitionTo: 'accepted' };
}

const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateValidation =
  | { ok: true }
  | { ok: false; statusCode: 400; reason: 'invalid_email' | 'invalid_role' | 'missing_field' };

export function validateCreateInput(input: {
  email?: unknown;
  role?: unknown;
  orgId?: unknown;
  invitedByUserId?: unknown;
}): CreateValidation {
  if (
    typeof input.email !== 'string' ||
    typeof input.role !== 'string' ||
    typeof input.orgId !== 'string' ||
    typeof input.invitedByUserId !== 'string'
  ) {
    return { ok: false, statusCode: 400, reason: 'missing_field' };
  }
  if (!EMAIL_RX.test(input.email)) {
    return { ok: false, statusCode: 400, reason: 'invalid_email' };
  }
  if (!['admin', 'reviewer', 'read_only'].includes(input.role)) {
    return { ok: false, statusCode: 400, reason: 'invalid_role' };
  }
  return { ok: true };
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function defaultInvitationExpiry(now: Date): Date {
  return new Date(now.getTime() + SEVEN_DAYS_MS);
}

/** Build a URL-safe random invitation code. Uses Web Crypto only. */
export function generateInvitationCode(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) {
    s += b.toString(16).padStart(2, '0');
  }
  return s;
}

export function shareableInvitationUrl(baseUrl: string, code: string): string {
  const trimmed = baseUrl.replace(/\/$/, '');
  return `${trimmed}/verifier/invite/${code}/accept`;
}
