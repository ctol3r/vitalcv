/**
 * invitationRepo.ts
 *
 * Server-only Prisma repo for VerifierInvitation rows.
 * Composes invitationLifecycle.ts (pure decisions) + clerkInvitationSender.ts
 * (Clerk magic-link transport).
 */
import 'server-only';
import { prisma } from '@/lib/db';
import { sendInvitationViaClerk } from './clerkInvitationSender';
import {
  decideAccept,
  defaultInvitationExpiry,
  generateInvitationCode,
  shareableInvitationUrl,
  invitationSystemLive,
  type AcceptDecision,
  type EmailSendChannel,
  type InvitationStatus,
  type VerifierInvitationRow,
} from './invitationLifecycle';
import type { OrgRole } from '@/lib/verifier/orgRolesFoundation';

export { invitationSystemLive } from './invitationLifecycle';

export interface CreateInvitationInput {
  email: string;
  role: OrgRole;
  orgId: string;
  invitedByUserId: string;
  baseUrl: string;
  now?: Date;
}

export interface CreateInvitationResult {
  invitation: VerifierInvitationRow;
  shareableUrl: string;
  emailSendChannel: EmailSendChannel;
  invitationSystemLive: true;
}

function rowToDomain(row: {
  id: string;
  invitationCode: string;
  email: string;
  role: string;
  orgId: string;
  invitedByUserId: string;
  status: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  emailSendChannel: string;
  createdAt: Date;
}): VerifierInvitationRow {
  return {
    id: row.id,
    invitationCode: row.invitationCode,
    email: row.email,
    role: row.role as OrgRole,
    orgId: row.orgId,
    invitedByUserId: row.invitedByUserId,
    status: row.status as InvitationStatus,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    acceptedByUserId: row.acceptedByUserId,
    emailSendChannel: row.emailSendChannel as EmailSendChannel,
    createdAt: row.createdAt,
  };
}

export async function createInvitation(
  input: CreateInvitationInput,
): Promise<CreateInvitationResult> {
  const now = input.now ?? new Date();
  const code = generateInvitationCode();
  const expiresAt = defaultInvitationExpiry(now);
  const shareableUrl = shareableInvitationUrl(input.baseUrl, code);

  const channel = await sendInvitationViaClerk({
    email: input.email,
    redirectUrl: shareableUrl,
    invitationCode: code,
  });

  const created = await prisma.verifierInvitation.create({
    data: {
      invitationCode: code,
      email: input.email,
      role: input.role,
      orgId: input.orgId,
      invitedByUserId: input.invitedByUserId,
      status: 'pending',
      expiresAt,
      emailSendChannel: channel,
    },
  });

  return {
    invitation: rowToDomain(created),
    shareableUrl,
    emailSendChannel: channel,
    invitationSystemLive,
  };
}

export interface AcceptInvitationResult {
  decision: AcceptDecision;
  invitation: VerifierInvitationRow | null;
}

/**
 * Accept an invitation by code.
 *
 * Idempotency contract: when the row is already accepted, the decision
 * is 409 and the original row is returned unchanged — acceptedAt and
 * acceptedByUserId are NOT overwritten.
 */
export async function acceptInvitation(
  invitationCode: string,
  acceptingUserId: string,
  now: Date = new Date(),
): Promise<AcceptInvitationResult> {
  const row = await prisma.verifierInvitation.findUnique({
    where: { invitationCode },
  });
  const domain = row ? rowToDomain(row) : null;
  const decision = decideAccept(domain, now);

  if (!decision.ok) {
    return { decision, invitation: domain };
  }

  const updated = await prisma.verifierInvitation.update({
    where: { invitationCode },
    data: {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUserId: acceptingUserId,
    },
  });

  return { decision, invitation: rowToDomain(updated) };
}

export async function getInvitationByCode(
  invitationCode: string,
): Promise<VerifierInvitationRow | null> {
  const row = await prisma.verifierInvitation.findUnique({
    where: { invitationCode },
  });
  return row ? rowToDomain(row) : null;
}
