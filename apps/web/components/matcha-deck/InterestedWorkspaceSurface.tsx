'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { WorkspaceCard } from './WorkspaceCard'
import { useHydrated } from './useHydrated'
import { useWorkspaceMutations } from './useWorkspaceMutations'
import { COMPARE_FIELDS, toCompareColumn, type WorkspaceItem } from '@/lib/matcha-deck/workspace'

export interface InterestedWorkspaceSurfaceProps {
  signedIn: boolean
  items: WorkspaceItem[]
}

export function InterestedWorkspaceSurface({ signedIn, items }: InterestedWorkspaceSurfaceProps) {
  const { restore, pendingId, errorId } = useWorkspaceMutations()
  const [comparing, setComparing] = useState(false)
  const hydrated = useHydrated()

  const compareColumns = useMemo(
    () => items.map(toCompareColumn).filter((c): c is NonNullable<typeof c> => c !== null),
    [items],
  )

  return (
    <div className="mdk-root" data-mdk-ws-ready={hydrated ? 'true' : undefined}>
      <div className="mdk-shell">
        <header className="mdk-header">
          <div>
            <h1 className="mdk-title">Interested</h1>
            <p className="mdk-subtitle">
              Roles you saved from Discover, priority first. Compare them side by side — applying stays a
              separate, consented step.
            </p>
          </div>
          <nav className="mdk-mode-toggle" aria-label="Opportunity view">
            <Link href="/holder/opportunities/discover">Discover</Link>
            <Link href="/holder/opportunities/interested" aria-current="page">
              Interested
            </Link>
            <Link href="/holder/opportunities/passed">Passed</Link>
          </nav>
        </header>

        {!signedIn ? (
          <p className="mdk-sample-banner">Sign in to see the roles you’ve saved.</p>
        ) : items.length === 0 ? (
          <div className="mdk-done">
            <h2>No saved roles yet</h2>
            <p>Swipe right on a role in Discover to save it here. Nothing is applied until you choose to.</p>
            <div className="mdk-done-actions">
              <Link className="mdk-btn mdk-btn--interested" href="/holder/opportunities/discover">
                Open Discover
              </Link>
            </div>
          </div>
        ) : (
          <>
            {compareColumns.length >= 2 ? (
              <div className="mdk-ws-toolbar">
                <button
                  type="button"
                  className="mdk-btn"
                  aria-pressed={comparing}
                  onClick={() => setComparing((v) => !v)}
                >
                  {comparing ? 'Hide comparison' : `Compare ${compareColumns.length} roles`}
                </button>
              </div>
            ) : null}

            {comparing && compareColumns.length >= 2 ? (
              <div className="mdk-compare-scroll">
                <table className="mdk-compare">
                  <caption className="sr-only">Saved roles compared across key dimensions</caption>
                  <thead>
                    <tr>
                      <th scope="col">Dimension</th>
                      {compareColumns.map((col) => (
                        <th scope="col" key={col.opportunityId}>
                          <span className="mdk-compare-role">{col.title}</span>
                          <span className="mdk-compare-employer">{col.employerName}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_FIELDS.map((field) => (
                      <tr key={field.key}>
                        <th scope="row">{field.label}</th>
                        {compareColumns.map((col) => {
                          const value = col.cells[field.key].value
                          return (
                            <td key={col.opportunityId}>
                              {value ?? <span className="mdk-unknown-text">Not provided</span>}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="mdk-ws-list">
              {items.map((item) => (
                <WorkspaceCard
                  key={item.opportunityId}
                  item={item}
                  mode="interested"
                  onRestore={restore}
                  pending={pendingId === item.opportunityId}
                  errored={errorId === item.opportunityId}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
