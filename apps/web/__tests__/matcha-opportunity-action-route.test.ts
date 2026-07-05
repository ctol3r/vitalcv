/**
 * Wave K — server-persisted opportunity actions: route contract.
 *
 * POST /api/matcha/opportunity/[id]/action
 *   - identity comes from Clerk auth(), never a caller-supplied header
 *   - append-only OpportunityAction row + AuditEvent in ONE transaction
 *   - deploy-order safe: DB failure degrades to persisted:false, never a 500
 *
 * GET /api/matcha/opportunity-actions
 *   - latest row per opportunityId wins (append-only log collapse)
 *   - degrades to an empty map on DB failure
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const authMock = vi.fn();
const opportunityActionCreate = vi.fn();
const auditEventCreate = vi.fn();
const opportunityActionFindMany = vi.fn();
const transactionMock = vi.fn();

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    opportunityAction: {
      create: opportunityActionCreate,
      findMany: opportunityActionFindMany,
    },
    auditEvent: {
      create: auditEventCreate,
    },
    $transaction: transactionMock,
  },
}));

async function loadActionRoute() {
  return import(new URL('../app/api/matcha/opportunity/[id]/action/route.ts', import.meta.url).href);
}

async function loadActionsRoute() {
  return import(new URL('../app/api/matcha/opportunity-actions/route.ts', import.meta.url).href);
}

function postRequest(body: unknown) {
  return import('next/server').then(({ NextRequest }) =>
    new NextRequest('http://localhost/api/matcha/opportunity/opp-1/action', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  authMock.mockReset();
  opportunityActionCreate.mockReset();
  auditEventCreate.mockReset();
  opportunityActionFindMany.mockReset();
  transactionMock.mockReset();
  opportunityActionCreate.mockImplementation((args) => ({ __op: 'action', args }));
  auditEventCreate.mockImplementation((args) => ({ __op: 'audit', args }));
  transactionMock.mockResolvedValue([{}, {}]);
});

describe('POST /api/matcha/opportunity/[id]/action', () => {
  it('rejects unauthenticated callers without touching the DB', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await loadActionRoute();

    const res = await POST(await postRequest({ action: 'saved' }), params('opp-1'));

    expect(res.status).toBe(401);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects unknown action values', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    const { POST } = await loadActionRoute();

    const res = await POST(await postRequest({ action: 'applied' }), params('opp-1'));

    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('rejects malformed opportunity ids', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    const { POST } = await loadActionRoute();

    const res = await POST(await postRequest({ action: 'saved' }), params('has space'));

    expect(res.status).toBe(400);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('appends the action row and its AuditEvent in one transaction (audit-first)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    const { POST } = await loadActionRoute();

    const res = await POST(
      await postRequest({ action: 'saved', npi: '1003000126' }),
      params('opp-1'),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, persisted: true, action: 'saved' });

    expect(opportunityActionCreate).toHaveBeenCalledTimes(1);
    const actionData = opportunityActionCreate.mock.calls[0][0].data;
    expect(actionData).toMatchObject({
      clerkUserId: 'user_1',
      npi: '1003000126',
      opportunityId: 'opp-1',
      action: 'saved',
      source: 'web',
    });
    expect(actionData.id).toMatch(/^[0-9a-f-]{36}$/);

    expect(auditEventCreate).toHaveBeenCalledTimes(1);
    const auditData = auditEventCreate.mock.calls[0][0].data;
    expect(auditData.type).toBe('matcha.opportunity_action');
    expect(auditData.referenceId).toBe('opp-1');
    expect(auditData.clinicianId).toBe('1003000126');
    expect(auditData.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(auditData.metadata).toMatchObject({
      action: 'saved',
      actionId: actionData.id,
      clerkUserId: 'user_1',
      opportunityId: 'opp-1',
      source: 'web',
    });

    // Both writes travel through ONE transaction — no unaudited mutation path.
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2);
  });

  it("records 'cleared' as an append (toggle back to new), never a delete", async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    const { POST } = await loadActionRoute();

    const res = await POST(await postRequest({ action: 'cleared' }), params('opp-1'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ persisted: true, action: 'cleared' });
    expect(opportunityActionCreate.mock.calls[0][0].data.action).toBe('cleared');
  });

  it('drops a malformed NPI instead of persisting it', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    const { POST } = await loadActionRoute();

    await POST(await postRequest({ action: 'saved', npi: 'not-an-npi' }), params('opp-1'));

    expect(opportunityActionCreate.mock.calls[0][0].data.npi).toBeNull();
  });

  it('degrades to persisted:false when the table is not deployed yet (never a 500)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    transactionMock.mockRejectedValue(new Error('P2021: table does not exist'));
    const { POST } = await loadActionRoute();

    const res = await POST(await postRequest({ action: 'saved' }), params('opp-1'));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: false, persisted: false, action: 'saved' });
  });
});

describe('GET /api/matcha/opportunity-actions', () => {
  it('rejects unauthenticated callers', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { GET } = await loadActionsRoute();

    const res = await GET();

    expect(res.status).toBe(401);
    expect(opportunityActionFindMany).not.toHaveBeenCalled();
  });

  it('collapses the append-only log to the latest decision per opportunity', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    // Newest-first, as the route orders by createdAt desc.
    opportunityActionFindMany.mockResolvedValue([
      { opportunityId: 'a', action: 'cleared' },
      { opportunityId: 'a', action: 'saved' },
      { opportunityId: 'b', action: 'connected' },
      { opportunityId: 'b', action: 'declined' },
    ]);
    const { GET } = await loadActionsRoute();

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      actions: { a: 'cleared', b: 'connected' },
    });
    expect(opportunityActionFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { clerkUserId: 'user_1' },
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('degrades to an empty map when the table is not deployed yet (never a 500)', async () => {
    authMock.mockResolvedValue({ userId: 'user_1' });
    opportunityActionFindMany.mockRejectedValue(new Error('P2021: table does not exist'));
    const { GET } = await loadActionsRoute();

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ actions: {} });
  });
});
