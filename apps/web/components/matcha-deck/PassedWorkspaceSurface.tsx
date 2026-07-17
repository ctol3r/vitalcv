'use client'

import Link from 'next/link'

import { WorkspaceCard } from './WorkspaceCard'
import { useWorkspaceMutations } from './useWorkspaceMutations'
import type { WorkspaceItem } from '@/lib/matcha-deck/workspace'

export interface PassedWorkspaceSurfaceProps {
  signedIn: boolean
  items: WorkspaceItem[]
}

export function PassedWorkspaceSurface({ signedIn, items }: PassedWorkspaceSurfaceProps) {
  const { restore, pendingId, errorId } = useWorkspaceMutations()

  return (
    <div className="mdk-root">
      <div className="mdk-shell">
        <header className="mdk-header">
          <div>
            <h1 className="mdk-title">Passed</h1>
            <p className="mdk-subtitle">
              Roles you passed on. They stay here so you never have to swipe back through the deck to find
              one — restore any of them to Discover.
            </p>
          </div>
          <nav className="mdk-mode-toggle" aria-label="Opportunity view">
            <Link href="/holder/opportunities/discover">Discover</Link>
            <Link href="/holder/opportunities/interested">Interested</Link>
            <Link href="/holder/opportunities/passed" aria-current="page">
              Passed
            </Link>
          </nav>
        </header>

        {!signedIn ? (
          <p className="mdk-sample-banner">Sign in to see the roles you’ve passed on.</p>
        ) : items.length === 0 ? (
          <div className="mdk-done">
            <h2>Nothing passed yet</h2>
            <p>Roles you swipe left on in Discover collect here, so a pass is never a dead end.</p>
            <div className="mdk-done-actions">
              <Link className="mdk-btn mdk-btn--interested" href="/holder/opportunities/discover">
                Open Discover
              </Link>
            </div>
          </div>
        ) : (
          <div className="mdk-ws-list">
            {items.map((item) => (
              <WorkspaceCard
                key={item.opportunityId}
                item={item}
                mode="passed"
                onRestore={restore}
                pending={pendingId === item.opportunityId}
                errored={errorId === item.opportunityId}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
