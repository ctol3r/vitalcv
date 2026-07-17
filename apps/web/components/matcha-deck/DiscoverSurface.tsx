'use client'

/**
 * MATCHA Discover — the deck surface (PR J1).
 *
 * Hosts the MATCHA Deck under the holder workspace: header with the
 * Discover | Search mode toggle, an unmissable sample-data banner while the
 * deck runs on fixtures, and the deck itself. Live MATCHA recommendations
 * replace the fixture source behind the same DeckSource contract (PR J3).
 */

import Link from 'next/link'
import { useCallback } from 'react'

import { MatchaDeck } from './MatchaDeck'
import { fixtureDeckSource } from './fixtures'
import type { DeckSignal, DeckSource } from './types'

declare global {
  interface Window {
    __mdkSignals?: DeckSignal[]
  }
}

export interface DiscoverSurfaceProps {
  source?: DeckSource
}

export function DiscoverSurface({ source = fixtureDeckSource }: DiscoverSurfaceProps) {
  // J1: signals stay in memory (persistence is PR J2). They are mirrored to
  // window.__mdkSignals so browser verification can assert exactly-once
  // emission without any network side effects.
  const handleSignal = useCallback((signal: DeckSignal) => {
    if (typeof window === 'undefined') return
    window.__mdkSignals = window.__mdkSignals ?? []
    window.__mdkSignals.push(signal)
  }, [])

  return (
    <div className="mdk-root">
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
