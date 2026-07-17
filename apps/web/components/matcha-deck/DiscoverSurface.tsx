'use client'

/**
 * MATCHA Discover — the deck surface (PR J1).
 *
 * Hosts the MATCHA Deck under the holder workspace: header with the
 * Discover | Search mode toggle, an unmissable sample-data banner when the
 * server explicitly selects preview mode, and the deck itself. The client
 * never selects or falls back to fixture data.
 */

import Link from 'next/link'
import { useCallback, useMemo } from 'react'

import { MatchaDeck } from './MatchaDeck'
import { createDeckSource } from './sourceBoundary'
import type { DeckSignal, DeckSourcePayload } from './types'

declare global {
  interface Window {
    __mdkSignals?: DeckSignal[]
  }
}

export interface DiscoverSurfaceProps {
  payload: DeckSourcePayload
}

export function DiscoverSurface({ payload }: DiscoverSurfaceProps) {
  const source = useMemo(() => createDeckSource(payload), [payload])
  // J1: signals stay in memory (persistence is PR J2). They are mirrored to
  // window.__mdkSignals so browser verification can assert exactly-once
  // emission without any network side effects.
  const handleSignal = useCallback((signal: DeckSignal) => {
    if (typeof window === 'undefined') return
    window.__mdkSignals = window.__mdkSignals ?? []
    window.__mdkSignals.push(signal)
  }, [])

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

        <MatchaDeck source={source} onSignal={handleSignal} />
      </div>
    </div>
  )
}
