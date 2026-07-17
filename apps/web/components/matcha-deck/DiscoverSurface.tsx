'use client'

/**
 * MATCHA Discover — the deck surface (PR J1, persistence PR J2).
 *
 * Hosts the MATCHA Deck under the holder workspace: header with the
 * Discover | Search mode toggle, an unmissable sample-data banner when the
 * server explicitly selects preview mode, and the deck itself. The client
 * never selects or falls back to fixture data.
 *
 * Decisions on a live deck are queued to the clinician's own append-only
 * decision log. Fixture decisions are never persisted — those opportunity ids
 * are not real, and the banner says so.
 */

import Link from 'next/link'
import { useCallback, useMemo } from 'react'

import { MatchaDeck } from './MatchaDeck'
import { createDeckSource } from './sourceBoundary'
import { useDeckSignals } from './useDeckSignals'
import type { DeckSignal, DeckSourcePayload } from './types'

declare global {
  interface Window {
    __mdkSignals?: DeckSignal[]
  }
}

export interface DiscoverSurfaceProps {
  payload: DeckSourcePayload
  /** The clinician's NPI, when known — attributed onto persisted signals. */
  npi?: string | null
}

export function DiscoverSurface({ payload, npi }: DiscoverSurfaceProps) {
  const source = useMemo(() => createDeckSource(payload), [payload])
  // Persistence follows the server's source decision: a preview deck's
  // opportunity ids are not real, so its decisions are never written.
  const { emit, unsavedCount, retryUnsaved } = useDeckSignals({
    enabled: !source.isFixture,
    npi,
  })

  const handleSignal = useCallback(
    (signal: DeckSignal) => {
      emit(signal)
      // Mirrored to window.__mdkSignals so browser verification can assert
      // exactly-once emission independently of any network side effects.
      if (typeof window === 'undefined') return
      window.__mdkSignals = window.__mdkSignals ?? []
      window.__mdkSignals.push(signal)
    },
    [emit],
  )

  return (
    <div className="mdk-root" data-matcha-deck-source-mode={payload.mode}>
      <div className="mdk-shell">
        <header className="mdk-header">
          <div>
            <h1 className="mdk-title">Discover</h1>
            <p className="mdk-subtitle">
              Swipe through roles matched to your evidence and stated preferences. Interested saves a
              role for you — applying is always a separate step with evidence preview and consent.
            </p>
          </div>
          <nav className="mdk-mode-toggle" aria-label="Opportunity view mode">
            <Link href="/holder/opportunities/discover" aria-current="page">
              Discover
            </Link>
            <Link href="/holder/opportunities">Search</Link>
          </nav>
        </header>

        {source.isFixture ? (
          <p className="mdk-sample-banner" data-mdk-sample-banner="true">
            <span aria-hidden="true">◌</span>
            {source.sourceLabel}. Decisions here are practice only and are not saved.
          </p>
        ) : null}

        {unsavedCount > 0 ? (
          <p className="mdk-unsaved-banner" role="status" data-mdk-unsaved={unsavedCount}>
            <span aria-hidden="true">◌</span>
            <span>
              {unsavedCount === 1 ? '1 decision was not saved' : `${unsavedCount} decisions were not saved`}
              . They are still on this device only.
            </span>
            <button type="button" className="mdk-btn mdk-btn--retry" onClick={retryUnsaved}>
              Try again
            </button>
          </p>
        ) : null}

        <MatchaDeck source={source} onSignal={handleSignal} />
      </div>
    </div>
  )
}
