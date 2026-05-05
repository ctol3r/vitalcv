/**
 * verifier-invitation-lifecycle.test.ts
 *
 * Tests the verifier invitation lifecycle (create + accept) with
 * Prisma and the Clerk sender mocked.
 *
 * Truth contracts verified:
 *   1. POST creates invitation row + returns shareableUrl + invitationSystemLive: true
 *   2. acceptInvitation: pending non-expired → success; row transitions to accepted
 *   3. acceptInvitation: expired (expiresAt < now) → 410 Gone
 *   4. acceptInvitation: already-accepted → 409 Conflict (idempotent — original row preserved)
 *   5. invitationSystemLive is the literal true (foundation flip)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const authMock = vi.fn();
const sendInvitationViaClerkMock = vi.fn();

const prismaCreate = vi.fn();
const prismaFindUnique = vi.fn();
const prismaUpdate = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('../lib/db', () => ({
  prisma: {
    verifierInvitation: {
      create: prismaCreate,
      findUnique: prismaFindUnique,
      update: prismaUpdate,
    },
  },
}));

vi.mock('../lib/auth/clerkInvitationSender', () => ({
  sendInvitationViaClerk: sendInvitationViaClerkMock,
}));

vi.mock('server-only', () => ({}));

interface RawRow {
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
}

function buildRawRow(overrides: Partial<RawRow> = {}): RawRow {
  return {
    id: 'cuid-001',
    invitationCode: 'inv-code-abc',
    email: 'teammate@example.com',
    role: 'reviewer',
    orgId: 'org_test',
    invitedByUserId: 'user_inviter',
    status: 'pending',
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    acceptedAt: null,
    acceptedByUserId: null,
    emailSendChannel: 'shareable_url_only',
    createdAt: new Date('2026-05-04T00:00:00.000Z'),
    ...overrides,
  };
}

describe('verifier invitation lifecycle', () => {
  beforeEach(() => {
    vi.resetModules();
    authMock.mockReset();
    sendInvitationViaClerkMock.mockReset();
    prismaCreate.mockReset();
    prismaFindUnique.mockReset();
    prismaUpdate.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('case 1: POST /api/verifier/invite creates a row and returns shareableUrl + invitationSystemLive: true', async () => {
    authMock.mockResolvedValue({
      userId: 'user_inviter',
      sessionClaims: { vitalcv: { org_id: 'org_test' } },
    });
    sendInvitationViaClerkMock.mockResolvedValue('clerk_magic_link');
    prismaCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(buildRawRow({
        invitationCode: data.invitationCode as string,
        email: data.email as string,
        role: data.role as string,
        emailSendChannel: data.emailSendChannel as string,
      })),
    );

    const { POST } = await import('../app/api/verifier/invite/route');
    const req = new NextRequest('http://localhost/api/verifier/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'teammate@example.com', role: 'reviewer' }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json() as {
      invitation: { invitationCode: string; status: string };
      shareableUrl: string;
      emailSendChannel: string;
      invitationSystemLive: boolean;
    };

    expect(body.invitationSystemLive).toBe(true);
    expect(body.shareableUrl).toMatch(/\/verifier\/invite\/[a-f0-9]+\/accept$/);
    expect(body.emailSendChannel).toBe('clerk_magic_link');
    expect(body.invitation.status).toBe('pending');
    expect(prismaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'teammate@example.com',
          role: 'reviewer',
          orgId: 'org_test',
          status: 'pending',
        }),
      }),
    );
  });

  it('case 2: acceptInvitation on pending non-expired invitation transitions to accepted', async () => {
    const future = new Date('2027-01-01T00:00:00.000Z');
    prismaFindUnique.mockResolvedValue(buildRawRow({ status: 'pending', expiresAt: future }));
    prismaUpdate.mockResolvedValue(
      buildRawRow({
        status: 'accepted',
        acceptedAt: new Date('2026-05-04T12:00:00.000Z'),
        acceptedByUserId: 'user_acceptor',
        expiresAt: future,
      }),
    );

    const { acceptInvitation } = await import('../lib/auth/invitationRepo');
    const result = await acceptInvitation('inv-code-abc', 'user_acceptor', new Date('2026-05-04T12:00:00.000Z'));

    expect(result.decision.ok).toBe(true);
    expect(result.invitation?.status).toBe('accepted');
    expect(result.invitation?.acceptedByUserId).toBe('user_acceptor');
    expect(prismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { invitationCode: 'inv-code-abc' },
        data: expect.objectContaining({ status: 'accepted', acceptedByUserId: 'user_acceptor' }),
      }),
    );
  });

  it('case 3: expired invitation returns 410 Gone — no DB write', async () => {
    const past = new Date('2026-04-01T00:00:00.000Z');
    prismaFindUnique.mockResolvedValue(buildRawRow({ status: 'pending', expiresAt: past }));

    const { acceptInvitation } = await import('../lib/auth/invitationRepo');
    const result = await acceptInvitation('inv-code-abc', 'user_acceptor', new Date('2026-05-04T00:00:00.000Z'));

    expect(result.decision.ok).toBe(false);
    if (!result.decision.ok) {
      expect(result.decision.statusCode).toBe(410);
      expect(result.decision.reason).toBe('invitation_expired');
    }
    expect(prismaUpdate).not.toHaveBeenCalled();
  });

  it('case 4: already-accepted invitation returns 409 Conflict — idempotent (original acceptedAt preserved, no DB write)', async () => {
    const originalAcceptedAt = new Date('2026-04-15T08:00:00.000Z');
    prismaFindUnique.mockResolvedValue(
      buildRawRow({
        status: 'accepted',
        acceptedAt: originalAcceptedAt,
        acceptedByUserId: 'user_first_acceptor',
      }),
    );

    const { acceptInvitation } = await import('../lib/auth/invitationRepo');
    const result = await acceptInvitation('inv-code-abc', 'user_second_acceptor', new Date('2026-05-04T00:00:00.000Z'));

    expect(result.decision.ok).toBe(false);
    if (!result.decision.ok) {
      expect(result.decision.statusCode).toBe(409);
      expect(result.decision.reason).toBe('invitation_already_accepted');
    }
    // Idempotency: returned invitation preserves the original acceptedAt + acceptor
    expect(result.invitation?.acceptedAt?.toISOString()).toBe(originalAcceptedAt.toISOString());
    expect(result.invitation?.acceptedByUserId).toBe('user_first_acceptor');
    // No DB update was attempted
    expect(prismaUpdate).not.toHaveBeenCalled();
  });

  it('case 5: invitationSystemLive is the literal true (W6C foundation flip)', async () => {
    const { invitationSystemLive } = await import('../lib/auth/invitationLifecycle');
    const { buildOrgRolesFoundation } = await import('../lib/verifier/orgRolesFoundation');

    expect(invitationSystemLive).toBe(true);
    // Type-level: this would not compile if invitationSystemLive widened to boolean
    const literalCheck: true = invitationSystemLive;
    expect(literalCheck).toBe(true);

    expect(buildOrgRolesFoundation().invitationSystemLive).toBe(true);
  });
});
