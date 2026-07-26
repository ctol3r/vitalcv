/**
 * MATCHA Deck signal transport (PR J2) — a framework-free outbox.
 *
 * The deck must never wait on the network to advance a card, and a decision
 * the clinician made must never be silently dropped because a request failed.
 * So decisions go into an in-memory outbox that drains in order and retries,
 * and the deck reports honestly when something is still unsaved.
 *
 * Exactly-once is the server's job, not a hope: every queued signal carries a
 * stable `clientSignalId`, so a retry (or a replayed emit) collapses onto the
 * same row server-side instead of duplicating the event.
 *
 * Ordering matters — `passed` then `restored` on the same card must not land
 * reversed — so the outbox drains strictly sequentially, one in flight at a
 * time, and a failed signal blocks its successors rather than letting a later
 * decision overtake it.
 *
 * Pure: no React, no fetch, no timers of its own. The caller injects `post`
 * and `wait`, which makes every branch here testable without a network.
 */

import type { DeckSignal } from './types'

export interface QueuedSignal extends DeckSignal {
  /** Stable idempotency key — survives retries so the server can collapse them. */
  clientSignalId: string
  sessionId: string
}

export interface PostResult {
  persisted: boolean
}

export interface SignalTransportOptions {
  /** Sends one signal. Rejects (or returns persisted:false) on failure. */
  post: (signal: QueuedSignal) => Promise<PostResult>
  /** Injected so tests need no real timers. */
  wait?: (ms: number) => Promise<void>
  /** Attempts per signal before it is parked as unsaved. */
  maxAttempts?: number
  /** Backoff before attempt n (1-indexed). */
  backoffMs?: (attempt: number) => number
  /** Fires whenever the unsaved count changes, so the UI can be honest. */
  onUnsavedChange?: (unsavedCount: number) => void
}

const DEFAULT_MAX_ATTEMPTS = 4

function defaultBackoff(attempt: number): number {
  // 0.4s, 0.8s, 1.6s — bounded, and short enough that a flaky connection
  // recovers within a normal swiping session.
  return 400 * 2 ** (attempt - 1)
}

export class SignalTransport {
  private queue: QueuedSignal[] = []
  private draining = false
  private unsaved: QueuedSignal[] = []
  private readonly opts: Required<Omit<SignalTransportOptions, 'onUnsavedChange'>> &
    Pick<SignalTransportOptions, 'onUnsavedChange'>

  constructor(options: SignalTransportOptions) {
    this.opts = {
      post: options.post,
      wait: options.wait ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
      maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      backoffMs: options.backoffMs ?? defaultBackoff,
      onUnsavedChange: options.onUnsavedChange,
    }
  }

  /** Queue a signal and start draining. Never throws; never blocks the caller. */
  enqueue(signal: QueuedSignal): void {
    this.queue.push(signal)
    void this.drain()
  }

  /** Signals that exhausted their retries. The UI must surface these. */
  unsavedSignals(): readonly QueuedSignal[] {
    return this.unsaved
  }

  /** Re-queue everything that failed — the "Try again" affordance. */
  retryUnsaved(): void {
    if (this.unsaved.length === 0) return
    const retrying = this.unsaved
    this.unsaved = []
    this.opts.onUnsavedChange?.(0)
    // Preserve original order ahead of anything queued since.
    this.queue = [...retrying, ...this.queue]
    void this.drain()
  }

  /** Resolves once the outbox is empty (or everything left is parked). */
  async settled(): Promise<void> {
    while (this.draining) {
      await this.opts.wait(0)
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return
    this.draining = true
    try {
      while (this.queue.length > 0) {
        // Peek, don't shift: a failed signal must keep its place so a later
        // decision on the same card can never land before it.
        const signal = this.queue[0]
        const delivered = await this.attempt(signal)
        this.queue.shift()
        if (!delivered) {
          this.unsaved.push(signal)
          this.opts.onUnsavedChange?.(this.unsaved.length)
        }
      }
    } finally {
      this.draining = false
    }
  }

  private async attempt(signal: QueuedSignal): Promise<boolean> {
    for (let attempt = 1; attempt <= this.opts.maxAttempts; attempt += 1) {
      try {
        const result = await this.opts.post(signal)
        if (result.persisted) return true
      } catch {
        // Fall through to the retry decision below.
      }
      if (attempt < this.opts.maxAttempts) {
        await this.opts.wait(this.opts.backoffMs(attempt))
      }
    }
    return false
  }
}
