import { afterEach, describe, expect, it, vi } from 'vitest'

import { emitApplyFunnelSignal } from '@/lib/matcha-deck/applyFunnel'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('apply-funnel signal emission (J5)', () => {
  it('POSTs application_started to the unified signal route with an idempotency key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ persisted: true }) })
    vi.stubGlobal('fetch', fetchMock)

    await emitApplyFunnelSignal('application_started', {
      opportunityId: 'opp-123',
      npi: '1234567890',
      opportunityVersion: '2026-07-17T00:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/matcha/deck/signal')
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(true)
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      action: 'application_started',
      opportunityId: 'opp-123',
      npi: '1234567890',
      opportunityVersion: '2026-07-17T00:00:00.000Z',
    })
    expect(typeof body.clientSignalId).toBe('string')
    expect(body.clientSignalId.length).toBeGreaterThan(0)
  })

  it('emits application_submitted and omits npi when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    await emitApplyFunnelSignal('application_submitted', { opportunityId: 'opp-9' })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.action).toBe('application_submitted')
    expect(body).not.toHaveProperty('npi') // undefined is dropped by JSON.stringify
  })

  it('never throws — a failed signal must not break the apply flow', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      emitApplyFunnelSignal('application_submitted', { opportunityId: 'opp-1' }),
    ).resolves.toBeUndefined()
  })

  it('generates a distinct idempotency key per call so genuine re-emits are not collapsed', async () => {
    const keys: string[] = []
    const fetchMock = vi.fn().mockImplementation((_url, init) => {
      keys.push(JSON.parse(init.body).clientSignalId)
      return Promise.resolve({ ok: true, json: async () => ({}) })
    })
    vi.stubGlobal('fetch', fetchMock)

    await emitApplyFunnelSignal('application_started', { opportunityId: 'opp-1' })
    await emitApplyFunnelSignal('application_started', { opportunityId: 'opp-1' })

    expect(keys[0]).not.toBe(keys[1])
  })
})
