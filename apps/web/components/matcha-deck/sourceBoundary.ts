import type {
  DeckRecommendation,
  DeckSource,
  DeckSourcePayload,
  MatchaDeckSourceMode,
} from './types'

const FIXTURE_VALUE_PATTERN = /(^fx-)|\b(sample|fixture)\b/iu
const FIXTURE_APPLY_BLOCK_REASON = 'Sample listing — Apply with VitalCV is available on live roles.'

export interface MatchaDeckPayloadInput {
  mode: MatchaDeckSourceMode
  sourceLabel: string
  recommendations: DeckRecommendation[]
  emptyMessage?: string
  /** Clinician home state (2-letter), for the "Near me" mode (J6). */
  homeState?: string
}

export interface MatchaDeckPreviewEnvironment {
  NODE_ENV?: string
  MATCHA_DECK_PREVIEW?: string
  RAILWAY_ENVIRONMENT?: string
  VERCEL_ENV?: string
}

function containsFixtureString(value: unknown): boolean {
  if (typeof value === 'string') return FIXTURE_VALUE_PATTERN.test(value)
  if (Array.isArray(value)) return value.some(containsFixtureString)
  if (!value || typeof value !== 'object') return false

  return Object.values(value).some(containsFixtureString)
}

/** Fail closed if sample markers cross into a live production payload. */
export function assertNoFixtureMarkersInLivePayload(payload: DeckSourcePayload): void {
  if (payload.mode !== 'live') {
    throw new Error('Production MATCHA payloads must use live mode.')
  }

  if (containsFixtureString(payload.sourceLabel)) {
    throw new Error('Fixture marker detected in live MATCHA payload source label.')
  }

  for (const recommendation of payload.recommendations) {
    if (recommendation.isFixture || containsFixtureString(recommendation)) {
      throw new Error(
        `Fixture marker detected in live MATCHA payload for ${recommendation.recommendationId}.`,
      )
    }
  }
}

/**
 * A production build may expose the harness only when an explicit preview
 * flag is present, and never from the canonical Railway/Vercel production
 * environment. Development is an implicit non-production preview context.
 */
export function isMatchaDeckPreviewAllowed(env: MatchaDeckPreviewEnvironment): boolean {
  if (env.NODE_ENV !== 'production') return true

  const isCanonicalProduction =
    env.RAILWAY_ENVIRONMENT?.trim().toLowerCase() === 'production'
    || env.VERCEL_ENV?.trim().toLowerCase() === 'production'

  return env.MATCHA_DECK_PREVIEW === '1' && !isCanonicalProduction
}

export function createDeckSourcePayload(input: MatchaDeckPayloadInput): DeckSourcePayload {
  if (input.mode === 'empty') {
    if (input.recommendations.length > 0) {
      throw new Error('Empty MATCHA payloads cannot contain recommendations.')
    }
    return { ...input, recommendations: [] }
  }

  if (input.mode === 'preview_fixture') {
    return {
      ...input,
      recommendations: input.recommendations.map((recommendation) => ({
        ...recommendation,
        isFixture: true,
        actions: {
          ...recommendation.actions,
          canApply: false,
          applyBlockReason: FIXTURE_APPLY_BLOCK_REASON,
        },
      })),
    }
  }

  const payload: DeckSourcePayload = { ...input }
  assertNoFixtureMarkersInLivePayload(payload)
  return payload
}

export function createDeckSource(payload: DeckSourcePayload): DeckSource {
  return {
    mode: payload.mode,
    sourceLabel: payload.sourceLabel,
    isFixture: payload.mode === 'preview_fixture',
    emptyMessage: payload.emptyMessage,
    load: async () => payload.recommendations,
  }
}
