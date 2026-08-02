/**
 * sourceRuntime.ts — public source-runtime transparency endpoints.
 *
 * These routes report whether a source is actually live. They do not report
 * source secrets and they do not turn runtime health into a credential verdict.
 *
 * They are genuinely reachable without an organization: `tenantGuard` skips
 * these two paths by exact match. For eighteen months the header above said
 * "public" while the guard returned 401 to every caller — the claim and the
 * behaviour are now the same thing.
 *
 * Being actually public changes two things about how they must be written:
 *
 *   1. A list response costs three database queries per registered source —
 *      sixty at present. Unauthenticated and uncached, that is a denial-of-
 *      service surface, so the list is rate limited AND served from a short
 *      in-process cache.
 *   2. The payload may carry no identifier that belongs to a clinician. See
 *      `toPublicState` below.
 */

import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import {
  getSourceRuntimeState,
  listSourceRuntimeStates,
  type SourceRuntimeState,
} from '../services/identity/sourceRuntimeState';

export interface SourceRuntimeRouteDependencies {
  listStates?: () => Promise<SourceRuntimeState[]>;
  getState?: (sourceId: string) => Promise<SourceRuntimeState | null>;
}

/** What an anonymous caller receives. */
export type PublicSourceRuntimeState = Omit<SourceRuntimeState, 'lastArtifactId'>;

/**
 * Strip `lastArtifactId` before publishing.
 *
 * `findLatestArtifact` selects the newest artifact for a source across ALL
 * clinicians, with no NPI scoping — so that field is a real person's
 * verification-artifact id. Six routes dereference an `:artifactId`
 * (`/api/transparency/`, `/api/audit-packet/`, `/api/credential-status/`,
 * `/api/verifier/audit-bundle/`, `/api/cross-check-bundle/`,
 * `/api/internal/artifact-merkle/`). All six are tenant-guarded today, and
 * each was probed against production to confirm it: all 401.
 *
 * So this is not a live leak — it is a dependency on six unrelated routes
 * never becoming public, to protect a field with no consumers and no
 * transparency value. Freshness is already carried by `lastSuccessfulAt` and
 * `freshnessStatus`. The id buys the reader nothing, so it does not ship.
 */
function toPublicState(state: SourceRuntimeState): PublicSourceRuntimeState {
  const { lastArtifactId: _lastArtifactId, ...pub } = state;
  return pub;
}

function normalizeSourceId(value: string): string {
  return value.trim().toUpperCase();
}

/**
 * Short in-process cache for the list.
 *
 * 30s, not the 5 minutes its `/trust-health` siblings use: this endpoint's job
 * is to say whether a source is live RIGHT NOW, and a five-minute-old liveness
 * claim is the kind of quiet overstatement the rest of this codebase works
 * hard to avoid. `computedAt` is inside the cached body, so a reader can always
 * see exactly how old the answer is rather than inferring it from the response.
 */
const LIST_CACHE_TTL_MS = 30 * 1000;

interface ListCacheEntry {
  body: { computedAt: string; liveDefinition: string; sources: PublicSourceRuntimeState[] };
  expiresAt: number;
}

let listCache: ListCacheEntry | null = null;

/** Exported for tests — an in-process cache outlives a single test case. */
export function __resetSourceRuntimeCache(): void {
  listCache = null;
}

export function registerSourceRuntimeRoutes(
  app: Express,
  dependencies: SourceRuntimeRouteDependencies = {},
): void {
  const listStates = dependencies.listStates ?? (() => listSourceRuntimeStates());
  const getState = dependencies.getState ?? ((sourceId: string) => getSourceRuntimeState(sourceId));

  app.get('/api/system/source-runtime', publicApiRateLimit, async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      if (listCache && Date.now() < listCache.expiresAt) {
        res.setHeader('X-Cache', 'HIT');
        res.json(listCache.body);
        return;
      }

      const sources = await listStates();
      const body = {
        computedAt: new Date().toISOString(),
        liveDefinition: 'canonical adapter + enabled configuration + required access + successful fresh persisted run and artifact',
        sources: sources.map(toPublicState),
      };
      listCache = { body, expiresAt: Date.now() + LIST_CACHE_TTL_MS };

      res.setHeader('X-Cache', 'MISS');
      res.json(body);
    } catch (error) {
      log('error', 'source_runtime: list_failed', { error: String(error) });
      res.status(503).json({
        error: 'source_runtime_unavailable',
        error_description: 'Source runtime state could not be computed. No source should be inferred live or clear.',
      });
    }
  });

  app.get('/api/system/source-runtime/:sourceId', publicApiRateLimit, async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const sourceId = normalizeSourceId(req.params.sourceId ?? '');
    if (!sourceId) {
      res.status(400).json({ error: 'source_id_required' });
      return;
    }

    try {
      const source = await getState(sourceId);
      if (!source) {
        res.status(404).json({
          error: 'source_not_registered',
          sourceId,
        });
        return;
      }

      res.json(toPublicState(source));
    } catch (error) {
      log('error', 'source_runtime: source_failed', { sourceId, error: String(error) });
      res.status(503).json({
        error: 'source_runtime_unavailable',
        sourceId,
        error_description: 'Source runtime state could not be computed. No source should be inferred live or clear.',
      });
    }
  });

  log('info', 'source_runtime: routes_registered', {
    routes: [
      'GET /api/system/source-runtime',
      'GET /api/system/source-runtime/:sourceId',
    ],
  });
}
