/**
 * PR J2 — the deck's signal outbox.
 *
 * The deck must never wait on the network, but a decision the clinician made
 * must never be silently dropped either. These tests pin both halves: the
 * enqueue never blocks, order is preserved even across retries, retries reuse
 * the same idempotency key, and a decision that truly cannot be saved is
 * reported rather than swallowed.
 */
import { describe, expect, it, vi } from 'vitest'

import { SignalTransport, type QueuedSignal } from '../components/matcha-deck/signalTransport'

function signal(action: QueuedSignal['action'], id: string): QueuedSignal {
  return {
    action,
    recommendationId: `rec-${id}`,
    opportunityId: `opp-${id}`,
    opportunityVersion: 'v1',
    clientSignalId: `cs-${id}-${action}`,
    sessionId: 'session-1',
  }
}

/** No real timers: backoff resolves immediately so tests stay fast and exact. */
const instant = { wait: async () => {}, backoffMs: () => 0 }

describe('SignalTransport — delivery', () => {
  it('delivers a queued signal', async () => {
    const post = vi.fn().mockResolvedValue({ persisted: true })
    const t = new SignalTransport({ post, ...instant })

    t.enqueue(signal('interested', '1'))
    await t.settled()

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][0]).toMatchObject({ action: 'interested', opportunityId: 'opp-1' })
    expect(t.unsavedSignals()).toHaveLength(0)
  })

  it('enqueue returns without waiting for delivery — the deck never blocks on the network', () => {
    // A post that never settles stands in for a dead connection.
    const post = vi.fn().mockReturnValue(new Promise<never>(() => {}))
    const t = new SignalTransport({ post, ...instant })

    // If enqueue awaited delivery, this call would never return and the
    // assertions below would never run.
    t.enqueue(signal('interested', '1'))
    t.enqueue(signal('passed', '2'))

    expect(t.unsavedSignals()).toHaveLength(0) // nothing lost, just in flight
  })

  it('drains strictly in order so a later decision never overtakes an earlier one', async () => {
    const seen: string[] = []
    const post = vi.fn().mockImplementation(async (s: QueuedSignal) => {
      seen.push(`${s.action}:${s.opportunityId}`)
      return { persisted: true }
    })
    const t = new SignalTransport({ post, ...instant })

    t.enqueue(signal('passed', '1'))
    t.enqueue(signal('restored', '1'))
    t.enqueue(signal('interested', '1'))
    await t.settled()

    expect(seen).toEqual(['passed:opp-1', 'restored:opp-1', 'interested:opp-1'])
  })

  it('keeps order even when an earlier signal needs retries', async () => {
    const seen: string[] = []
    let firstAttempts = 0
    const post = vi.fn().mockImplementation(async (s: QueuedSignal) => {
      if (s.action === 'passed') {
        firstAttempts += 1
        if (firstAttempts < 3) throw new Error('network')
      }
      seen.push(s.action)
      return { persisted: true }
    })
    const t = new SignalTransport({ post, ...instant })

    t.enqueue(signal('passed', '1'))
    t.enqueue(signal('restored', '1'))
    await t.settled()

    expect(seen).toEqual(['passed', 'restored'])
  })
})

describe('SignalTransport — retry and idempotency', () => {
  it('retries a failed post and reuses the SAME clientSignalId', async () => {
    let attempts = 0
    const post = vi.fn().mockImplementation(async () => {
      attempts += 1
      if (attempts < 3) throw new Error('offline')
      return { persisted: true }
    })
    const t = new SignalTransport({ post, ...instant })

    t.enqueue(signal('interested', '1'))
    await t.settled()

    expect(post).toHaveBeenCalledTimes(3)
    const keys = new Set(post.mock.calls.map((c) => (c[0] as QueuedSignal).clientSignalId))
    expect(keys.size).toBe(1) // one intent ⇒ one key ⇒ server collapses retries
    expect(t.unsavedSignals()).toHaveLength(0)
  })

  it('treats persisted:false as a failure — the server said it did not save', async () => {
    const post = vi.fn().mockResolvedValue({ persisted: false })
    const t = new SignalTransport({ post, maxAttempts: 2, ...instant })

    t.enqueue(signal('interested', '1'))
    await t.settled()

    expect(post).toHaveBeenCalledTimes(2)
    expect(t.unsavedSignals()).toHaveLength(1)
  })

  it('parks a signal as unsaved after exhausting attempts, and says so', async () => {
    const onUnsavedChange = vi.fn()
    const post = vi.fn().mockRejectedValue(new Error('offline'))
    const t = new SignalTransport({ post, maxAttempts: 2, onUnsavedChange, ...instant })

    t.enqueue(signal('interested', '1'))
    await t.settled()

    expect(post).toHaveBeenCalledTimes(2)
    expect(t.unsavedSignals()).toHaveLength(1)
    expect(t.unsavedSignals()[0]).toMatchObject({ opportunityId: 'opp-1' })
    expect(onUnsavedChange).toHaveBeenLastCalledWith(1)
  })

  it('a failed signal does not block the ones behind it from being attempted', async () => {
    const post = vi
      .fn()
      .mockImplementation(async (s: QueuedSignal) =>
        s.opportunityId === 'opp-1' ? Promise.reject(new Error('offline')) : { persisted: true },
      )
    const t = new SignalTransport({ post, maxAttempts: 1, ...instant })

    t.enqueue(signal('interested', '1'))
    t.enqueue(signal('passed', '2'))
    await t.settled()

    expect(t.unsavedSignals()).toHaveLength(1)
    expect(t.unsavedSignals()[0].opportunityId).toBe('opp-1')
  })
})

describe('SignalTransport — retryUnsaved', () => {
  it('re-sends parked signals in their original order and clears the count', async () => {
    const onUnsavedChange = vi.fn()
    let online = false
    const seen: string[] = []
    const post = vi.fn().mockImplementation(async (s: QueuedSignal) => {
      if (!online) throw new Error('offline')
      seen.push(s.opportunityId)
      return { persisted: true }
    })
    const t = new SignalTransport({ post, maxAttempts: 1, onUnsavedChange, ...instant })

    t.enqueue(signal('interested', '1'))
    t.enqueue(signal('passed', '2'))
    await t.settled()
    expect(t.unsavedSignals()).toHaveLength(2)

    online = true
    t.retryUnsaved()
    await t.settled()

    expect(seen).toEqual(['opp-1', 'opp-2'])
    expect(t.unsavedSignals()).toHaveLength(0)
    expect(onUnsavedChange).toHaveBeenLastCalledWith(0)
  })

  it('retryUnsaved with nothing parked is a no-op', async () => {
    const post = vi.fn().mockResolvedValue({ persisted: true })
    const t = new SignalTransport({ post, ...instant })

    t.retryUnsaved()
    await t.settled()

    expect(post).not.toHaveBeenCalled()
  })

  it('a retried signal keeps its original idempotency key', async () => {
    let online = false
    const post = vi.fn().mockImplementation(async () => {
      if (!online) throw new Error('offline')
      return { persisted: true }
    })
    const t = new SignalTransport({ post, maxAttempts: 1, ...instant })

    t.enqueue(signal('interested', '1'))
    await t.settled()
    const originalKey = t.unsavedSignals()[0].clientSignalId

    online = true
    t.retryUnsaved()
    await t.settled()

    const keys = new Set(post.mock.calls.map((c) => (c[0] as QueuedSignal).clientSignalId))
    expect(keys).toEqual(new Set([originalKey]))
  })
})
