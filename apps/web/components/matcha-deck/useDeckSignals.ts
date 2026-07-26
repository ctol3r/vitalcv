'use client'

/**
 * useDeckSignals (PR J2) — persists deck decisions without blocking the deck.
 *
 * Wraps the SignalTransport outbox in React: every signal the deck emits is
 * queued with a stable clientSignalId (so retries collapse server-side) and a
 * per-session id (so a run of decisions can be reconstructed). The deck never
 * awaits the network; if a decision cannot be saved after retries, the hook
 * reports it so the surface can say so plainly rather than pretend.
 *
 * Fixture decks never persist: their opportunity ids are not real, and writing
 * them to the clinician's decision log would be fabricating history.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { SignalTransport, type QueuedSignal } from './signalTransport'
import type { DeckSignal } from './types'

export interface UseDeckSignalsOptions {
  /** False for fixture decks — practice decisions are never persisted. */
  enabled: boolean
  npi?: string | null
}

export interface DeckSignalsApi {
  emit: (signal: DeckSignal) => void
  unsavedCount: number
  retryUnsaved: () => void
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Non-secret correlation id; only needs to be unique per session.
  return `mdk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function postSignal(signal: QueuedSignal, npi?: string | null): Promise<{ persisted: boolean }> {
  const res = await fetch('/api/matcha/deck/signal', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      action: signal.action,
      opportunityId: signal.opportunityId,
      opportunityVersion: signal.opportunityVersion,
      recommendationId: signal.recommendationId,
      clientSignalId: signal.clientSignalId,
      sessionId: signal.sessionId,
      npi: npi ?? undefined,
    }),
  })
  if (!res.ok) throw new Error(`signal post failed: ${res.status}`)
  const body = (await res.json()) as { persisted?: boolean }
  return { persisted: body.persisted === true }
}

export function useDeckSignals({ enabled, npi }: UseDeckSignalsOptions): DeckSignalsApi {
  const [unsavedCount, setUnsavedCount] = useState(0)
  const sessionIdRef = useRef<string>('')
  if (!sessionIdRef.current) sessionIdRef.current = newId()

  // npi can arrive after the first signals; read it through a ref so the
  // transport identity stays stable and the outbox is never rebuilt mid-drain.
  const npiRef = useRef(npi)
  useEffect(() => {
    npiRef.current = npi
  }, [npi])

  const transport = useMemo(
    () =>
      new SignalTransport({
        post: (signal) => postSignal(signal, npiRef.current),
        onUnsavedChange: setUnsavedCount,
      }),
    [],
  )

  const emit = useCallback(
    (signal: DeckSignal) => {
      if (!enabled) return
      transport.enqueue({
        ...signal,
        clientSignalId: newId(),
        sessionId: sessionIdRef.current,
      })
    },
    [enabled, transport],
  )

  const retryUnsaved = useCallback(() => {
    transport.retryUnsaved()
  }, [transport])

  return { emit, unsavedCount, retryUnsaved }
}
