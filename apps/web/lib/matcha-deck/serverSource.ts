import 'server-only'

import { auth } from '@clerk/nextjs/server'

import { createDeckSourcePayload } from '@/components/matcha-deck/sourceBoundary'
import type { DeckRecommendation, DeckSourcePayload } from '@/components/matcha-deck/types'
import { MARKETPLACE_BACKEND, buildMarketplaceHeaders } from '@/lib/server/marketplace-proxy'
import { toDeckRecommendations } from './liveRecommendation'

const NPI_RE = /^\d{10}$/

async function backendJson<T>(path: string, headers: Headers): Promise<T | null> {
  try {
    const res = await fetch(`${MARKETPLACE_BACKEND}${path}`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** The clinician's NPI from their workspace, or null if not yet bound. */
async function resolveNpi(headers: Headers): Promise<string | null> {
  const workspaces = await backendJson<{ personProfile?: { npi?: unknown } }>(
    '/api/me/workspaces',
    headers,
  )
  const npi = workspaces?.personProfile?.npi
  return typeof npi === 'string' && NPI_RE.test(npi) ? npi : null
}

/**
 * Live MATCHA recommendations for the signed-in clinician, mapped into deck
 * recommendations, or null when the feed cannot be served honestly (not signed
 * in, no NPI bound, backend unavailable, or an empty match set). Null routes
 * the surface to its explicit empty state — never to preview fixtures.
 */
async function loadLiveRecommendations(): Promise<DeckRecommendation[] | null> {
  const session = await auth()
  if (!session.userId) return null

  const headers = buildMarketplaceHeaders(session)
  const npi = await resolveNpi(headers)
  if (!npi) return null

  const payload = await backendJson<{ matches?: unknown }>(
    `/api/matcha/opportunities/${encodeURIComponent(npi)}`,
    headers,
  )
  if (!payload) return null

  const recommendations = toDeckRecommendations(payload.matches)
  return recommendations.length > 0 ? recommendations : null
}

export async function loadHolderMatchaDeckPayload(): Promise<DeckSourcePayload> {
  try {
    const recommendations = await loadLiveRecommendations()
    if (recommendations) {
      return createDeckSourcePayload({
        mode: 'live',
        sourceLabel: 'Live MATCHA recommendations',
        recommendations,
      })
    }
  } catch {
    // The holder route fails honestly below; fixtures are never a fallback.
  }

  return createDeckSourcePayload({
    mode: 'empty',
    sourceLabel: 'Live MATCHA feed unavailable',
    recommendations: [],
    emptyMessage:
      'Live MATCHA recommendations are not available right now. No sample roles have been substituted.',
  })
}
