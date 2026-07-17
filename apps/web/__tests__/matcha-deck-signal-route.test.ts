/**
 * PR J2 — deck signal persistence: route contract.
 *
 * POST /api/matcha/deck/signal
 *   - identity comes from Clerk auth(), never a caller-supplied header
 *   - append-only OpportunityAction row (+ AuditEvent for decisions) in ONE transaction
 *   - telemetry writes no audit row — a rendered card is not an auditable event
 *   - idempotent on clientSignalId, including under a concurrent-write race
 *   - a clientSignalId belonging to another user is never confirmed or overwritten
 *   - deploy-order safe: DB failure degrades to persisted:false, never a 500
 *
 * GET /api/matcha/deck/signals
 *   - latest decision per opportunity, read through the deck lens
 *   - degrades to an empty map on DB failure
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMock = vi.fn()
const opportunityActionCreate = vi.fn()
const opportunityActionFindUnique = vi.fn()
const opportunityActionFindMany = vi.fn()
const auditEventCreate = vi.fn()
const transactionMock = vi.fn()

vi.mock('@clerk/nextjs/server', () => ({ auth: authMock }))

vi.mock('@/lib/db', () => ({
  prisma: {
    opportunityAction: {
      create: opportunityActionCreate,
      findUnique: opportunityActionFindUnique,
      findMany: opportunityActionFindMany,
    },
    auditEvent: { create: auditEventCreate },
    $transaction: transactionMock,
  },
}))

async function loadSignalRoute() {
  return import(new URL('../app/api/matcha/deck/signal/route.ts', import.meta.url).href)
}

async function loadSignalsRoute() {
  return import(new URL('../app/api/matcha/deck/signals/route.ts', import.meta.url).href)
}

function req(body: unknown): Request {
  return new Request('http://localhost/api/matcha/deck/signal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const validSignal = {
  action: 'interested',
  opportunityId: 'opp-1',
  opportunityVersion: 'v1',
  recommendationId: 'rec-1',
  clientSignalId: 'cs-1',
  sessionId: 'sess-1',
  npi: '1234567893',
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ userId: 'user_1' })
  opportunityActionFindUnique.mockResolvedValue(null)
  opportunityActionCreate.mockImplementation((args: unknown) => args)
  auditEventCreate.mockImplementation((args: unknown) => args)
  transactionMock.mockResolvedValue([])
})

describe('POST /api/matcha/deck/signal — auth', () => {
  it('401s when there is no Clerk session', async () => {
    authMock.mockResolvedValue({ userId: null })
    const { POST } = await loadSignalRoute()
    const res = await POST(req(validSignal))
    expect(res.status).toBe(401)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('attributes the row to the Clerk user, ignoring any caller-supplied identity', async () => {
    const { POST } = await loadSignalRoute()
    await POST(req({ ...validSignal, clerkUserId: 'user_attacker' }))

    const row = opportunityActionCreate.mock.calls[0][0].data
    expect(row.clerkUserId).toBe('user_1')
  })
})

describe('POST /api/matcha/deck/signal — validation', () => {
  it('rejects an unknown action rather than writing it to the log', async () => {
    const { POST } = await loadSignalRoute()
    const res = await POST(req({ ...validSignal, action: 'swiped_sideways' }))
    expect(res.status).toBe(400)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('requires a clientSignalId — without one there is no idempotency', async () => {
    const { POST } = await loadSignalRoute()
    const res = await POST(req({ ...validSignal, clientSignalId: undefined }))
    expect(res.status).toBe(400)
    expect(transactionMock).not.toHaveBeenCalled()
  })

  it('rejects a malformed opportunity id', async () => {
    const { POST } = await loadSignalRoute()
    const res = await POST(req({ ...validSignal, opportunityId: 'has spaces' }))
    expect(res.status).toBe(400)
  })

  it('drops an invalid NPI instead of recording it', async () => {
    const { POST } = await loadSignalRoute()
    await POST(req({ ...validSignal, npi: '123' }))
    expect(opportunityActionCreate.mock.calls[0][0].data.npi).toBeNull()
  })

  it('rejects invalid json', async () => {
    const { POST } = await loadSignalRoute()
    const res = await POST(
      new Request('http://localhost/api/matcha/deck/signal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not json',
      }),
    )
    expect(res.status).toBe(400)
  })
})

describe('POST /api/matcha/deck/signal — append-only + audit', () => {
  it('writes the row and the audit event in ONE transaction', async () => {
    const { POST } = await loadSignalRoute()
    const res = await POST(req(validSignal))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, persisted: true, duplicate: false })
    expect(transactionMock).toHaveBeenCalledTimes(1)
    expect(transactionMock.mock.calls[0][0]).toHaveLength(2)
    expect(opportunityActionCreate).toHaveBeenCalledTimes(1)
    expect(auditEventCreate).toHaveBeenCalledTimes(1)
  })

  it('records the deck surface and the opportunity version the clinician saw', async () => {
    const { POST } = await loadSignalRoute()
    await POST(req(validSignal))

    expect(opportunityActionCreate.mock.calls[0][0].data).toMatchObject({
      action: 'interested',
      opportunityId: 'opp-1',
      opportunityVersion: 'v1',
      recommendationId: 'rec-1',
      sessionId: 'sess-1',
      clientSignalId: 'cs-1',
      surface: 'deck',
    })
  })

  it('undo appends a restored row — it never updates or deletes the original', async () => {
    const { POST } = await loadSignalRoute()
    await POST(req({ ...validSignal, action: 'restored', clientSignalId: 'cs-undo' }))

    expect(opportunityActionCreate.mock.calls[0][0].data.action).toBe('restored')
    expect(auditEventCreate).toHaveBeenCalledTimes(1)
  })

  it('telemetry writes the row but NO audit event', async () => {
    const { POST } = await loadSignalRoute()
    await POST(req({ ...validSignal, action: 'viewed', clientSignalId: 'cs-view' }))

    expect(transactionMock.mock.calls[0][0]).toHaveLength(1)
    expect(opportunityActionCreate).toHaveBeenCalledTimes(1)
    expect(auditEventCreate).not.toHaveBeenCalled()
  })

  it.each(['passed', 'priority', 'restored'] as const)('audits the %s decision', async (action) => {
    const { POST } = await loadSignalRoute()
    await POST(req({ ...validSignal, action, clientSignalId: `cs-${action}` }))
    expect(auditEventCreate).toHaveBeenCalledTimes(1)
  })
})

describe('POST /api/matcha/deck/signal — idempotency', () => {
  it('a replayed clientSignalId collapses onto the existing row', async () => {
    opportunityActionFindUnique.mockResolvedValue({ action: 'interested', clerkUserId: 'user_1' })
    const { POST } = await loadSignalRoute()
    const res = await POST(req(validSignal))

    expect(await res.json()).toMatchObject({ ok: true, persisted: true, duplicate: true })
    expect(transactionMock).not.toHaveBeenCalled()
    expect(opportunityActionCreate).not.toHaveBeenCalled()
  })

  it('a concurrent retry that loses the unique-index race still reports success', async () => {
    // Both requests saw no existing row; the second write violates the index.
    transactionMock.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }))
    const { POST } = await loadSignalRoute()
    const res = await POST(req(validSignal))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: true, persisted: true, duplicate: true })
  })

  it("never confirms or overwrites another user's clientSignalId", async () => {
    opportunityActionFindUnique.mockResolvedValue({ action: 'passed', clerkUserId: 'user_other' })
    const { POST } = await loadSignalRoute()
    const res = await POST(req(validSignal))

    expect(res.status).toBe(409)
    expect(await res.json()).not.toMatchObject({ action: 'passed' }) // no leak
    expect(transactionMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/matcha/deck/signal — deploy-order safety', () => {
  it('degrades to persisted:false on a DB failure instead of 500ing the deck', async () => {
    transactionMock.mockRejectedValue(new Error('relation does not exist'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { POST } = await loadSignalRoute()
    const res = await POST(req(validSignal))

    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ ok: false, persisted: false })
    errorSpy.mockRestore()
  })
})

describe('GET /api/matcha/deck/signals', () => {
  it('401s when there is no Clerk session', async () => {
    authMock.mockResolvedValue({ userId: null })
    const { GET } = await loadSignalsRoute()
    expect((await GET()).status).toBe(401)
  })

  it('reads only the authenticated clinician’s own rows', async () => {
    opportunityActionFindMany.mockResolvedValue([])
    const { GET } = await loadSignalsRoute()
    await GET()

    expect(opportunityActionFindMany.mock.calls[0][0].where).toEqual({ clerkUserId: 'user_1' })
  })

  it('returns the latest decision per opportunity through the deck lens', async () => {
    opportunityActionFindMany.mockResolvedValue([
      { opportunityId: 'opp-1', action: 'passed' },
      { opportunityId: 'opp-1', action: 'interested' },
      { opportunityId: 'opp-2', action: 'saved' },
      { opportunityId: 'opp-3', action: 'viewed' },
    ])
    const { GET } = await loadSignalsRoute()
    const body = await (await GET()).json()

    expect(body.decisions).toEqual({ 'opp-1': 'passed', 'opp-2': 'interested' })
  })

  it('degrades to an empty map on a DB failure', async () => {
    opportunityActionFindMany.mockRejectedValue(new Error('offline'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { GET } = await loadSignalsRoute()
    const res = await GET()

    expect(res.status).toBe(200)
    expect((await res.json()).decisions).toEqual({})
    errorSpy.mockRestore()
  })
})
