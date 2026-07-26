'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Remove / restore mutations for the Interested and Passed workspaces (J4).
 *
 * Both are the same canonical act: a `restored` signal clears the current
 * decision, returning the role to undecided (removed from Interested, or
 * brought back from Passed so the deck can show it again). Reuses the J2 signal
 * endpoint — idempotent on a client-generated clientSignalId — so a retried
 * click never duplicates the event.
 *
 * Optimistic: the caller hides the row immediately; on failure we surface an
 * error and re-reveal by refreshing the server component. The signal log stays
 * the source of truth.
 */
export interface WorkspaceMutations {
  restore: (opportunityId: string, opportunityVersion?: string | null) => Promise<void>
  pendingId: string | null
  errorId: string | null
}

function clientSignalId(): string {
  // Stable-enough idempotency key; the server unique index is the real guard.
  const rand = Array.from({ length: 4 }, () => Math.floor(Math.random() * 1e9).toString(36)).join('')
  return `wsrestore-${rand}`
}

export function useWorkspaceMutations(): WorkspaceMutations {
  const router = useRouter()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)

  const restore = useCallback(
    async (opportunityId: string, opportunityVersion?: string | null) => {
      setPendingId(opportunityId)
      setErrorId(null)
      try {
        const res = await fetch('/api/matcha/deck/signal', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            action: 'restored',
            opportunityId,
            opportunityVersion: opportunityVersion ?? undefined,
            clientSignalId: clientSignalId(),
          }),
        })
        const body = (await res.json().catch(() => ({}))) as { persisted?: boolean }
        if (!res.ok || body.persisted === false) {
          setErrorId(opportunityId)
          return
        }
        // Re-derive both workspaces from the server so the row leaves (or the
        // deck regains the role) without a client-side model of the log.
        router.refresh()
      } catch {
        setErrorId(opportunityId)
      } finally {
        setPendingId(null)
      }
    },
    [router],
  )

  return { restore, pendingId, errorId }
}
