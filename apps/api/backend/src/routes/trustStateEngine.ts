/**
 * trustStateEngine.ts (routes) — Wave 243: Trust State Engine Routes
 *
 * Routes:
 *   GET  /api/trust-state/:npi          — get current trust state (cached ≤1h or fresh)
 *   POST /api/trust-state/:npi/refresh  — force recomputation (requires x-clerk-user-id)
 *   GET  /api/trust-state/:npi/history  — past trust state snapshots
 */

import type { Express, Request, Response } from 'express';
import { CrsEngine } from '@vitalcv/crs';
import {
  TrustStateResolver,
  type AcceptanceScopeRecord,
  type TrustStateResolverDependencies,
  type TrustStateScope,
  trustStateLatencyHistogram,
} from '@vitalcv/trust-state';
import prisma from '../graphql/prisma_client';
import {
  refreshTrustState,
  getTrustStateHistory,
  getCachedTrustState,
} from '../services/trust/trustStateEngine';
import { appendAuditEvent } from '../services/audit/auditLedger';
import { PrismaBackedPsvStore } from '../services/psv/PrismaBackedPsvStore';
import { PrismaCredentialIngestionRepository } from '../../repositories/credentialIngestion.repo';
import { log } from '../obs/logger';
import {
  recordCacheLookup,
  recordResolverRuntime,
  recordTrustStateLatency,
  getPilotTelemetryDashboard,
} from '../services/system/pilotTelemetry';
import { getCacheCounters } from '../services/trust/trustStateCache';

// ── NPI validation ────────────────────────────────────────────────────────────

function isValidNpi(npi: string): boolean {
  return /^\d{10}$/.test(npi);
}

function toResolverBand(trustBand: 'L0' | 'L1' | 'L2' | 'L3'): 'GREEN' | 'YELLOW' | 'RED' {
  if (trustBand === 'L3') {
    return 'GREEN';
  }
  if (trustBand === 'L2' || trustBand === 'L1') {
    return 'YELLOW';
  }
  return 'RED';
}

function readScope(req: Request): Partial<TrustStateScope> | undefined {
  const employer_id =
    typeof req.query.employer_id === 'string' ? req.query.employer_id.trim() : '';
  const facility_id =
    typeof req.query.facility_id === 'string' ? req.query.facility_id.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';

  if (!employer_id && !facility_id && !role) {
    return undefined;
  }

  return {
    ...(employer_id ? { employer_id } : {}),
    ...(facility_id ? { facility_id } : {}),
    ...(role ? { role } : {}),
  };
}

function mapAcceptanceRowToScopeRecord(row: {
  subjectId: string;
  employerId: string;
  facilityId: string;
  acceptedAt: Date;
  acceptanceId: string;
  eventHash: string;
}): AcceptanceScopeRecord {
  return {
    clinician_id: row.subjectId,
    employer_id: row.employerId,
    facility_id: row.facilityId,
    role: '',
    accepted_at: row.acceptedAt.toISOString(),
    acceptance_id: row.acceptanceId,
    hash_anchor: row.eventHash,
    employer_proof: {
      type: 'PrismaAcceptanceEventHash',
      verificationMethod: `urn:vitalcv:acceptance:${row.acceptanceId}`,
      proofValue: row.eventHash,
    },
  };
}

export function buildTrustStateResolverDeps(): TrustStateResolverDependencies {
  const receipts = new PrismaBackedPsvStore();
  const ingestionRepository = new PrismaCredentialIngestionRepository();
  const crsEngine = new CrsEngine({
    receipts,
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        return (await prisma.acceptance.count({ where: { subjectId: clinician_id } })) > 0;
      },
    },
  });

  return {
    receipts,
    crs: {
      computeForClinician: (input) => crsEngine.computeForClinician(input),
    },
    acceptances: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        return (await prisma.acceptance.count({ where: { subjectId: clinician_id } })) > 0;
      },
      async listByClinician(clinician_id: string): Promise<AcceptanceScopeRecord[]> {
        const rows = await prisma.acceptance.findMany({
          where: { subjectId: clinician_id },
        });

        return rows.map(mapAcceptanceRowToScopeRecord);
      },
    },
    starts: {
      async existsForClinician(clinician_id: string): Promise<boolean> {
        return (await prisma.start.count({ where: { subjectId: clinician_id } })) > 0;
      },
    },
    artifacts: {
      async listCredentialArtifactsByClinician(clinician_id: string): Promise<readonly unknown[]> {
        const artifacts = await ingestionRepository.findActiveCredentialsByNpi(clinician_id);
        return artifacts.map(({ artifactId, artifact }) => ({
          id: artifactId,
          source: artifact.source_name,
          credential_hash: artifact.credential_hash,
        }));
      },
      async listVerificationArtifactsByClinician(clinician_id: string): Promise<readonly unknown[]> {
        const artifacts = await ingestionRepository.findVerificationArtifactsByNpi(clinician_id);
        return artifacts.map(({ artifactId, artifact }) => ({
          id: artifactId,
          source: artifact.source_name,
          related_credential_hash: artifact.related_credential_hash,
          verification_method: artifact.verification_method,
          fresh_until: artifact.fresh_until,
          evidence_hash: artifact.evidence_hash,
        }));
      },
    },
    audit: {
      append: async (event) => {
        const auditEntry = appendAuditEvent({
          category: 'TRUST_STATE_CHANGE',
          actor: 'system:trust-state-resolver',
          resource: `clinician:${event.clinician_id}`,
          requestFields: {
            clinician_id: event.clinician_id,
            event_type: event.event_type,
            occurred_at: event.occurred_at,
          },
          resultFields: event.metadata,
          severity: event.event_type === 'TRUST_STATE_DECAY' ? 'WARNING' : 'INFO',
        });

        return { audit_packet_id: auditEntry.eventId };
      },
    },
    telemetry: {
      recordResolverRuntime: async (measurement) => {
        recordResolverRuntime({
          latencyMs: measurement.latency_ms,
          band: measurement.band,
          blockingReasonCount: measurement.blocking_reason_count,
          startReady: measurement.start_ready,
        });
      },
    },
    now: () => new Date(),
  };
}

// ── Route registration ────────────────────────────────────────────────────────

export function registerTrustStateEngineRoutes(app: Express): void {

  /**
   * GET /api/trust-state/:npi
   * Returns the current trust state. Uses memory/Postgres cache first;
   * otherwise refreshes, persists, and primes the cache.
   */
  app.get('/api/trust-state/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    const startedAtMs = Date.now();
    let cacheStatus: 'hit' | 'miss' | 'unknown' = 'unknown';

    res.on('finish', () => {
      const latencyMs = Date.now() - startedAtMs;
      trustStateLatencyHistogram.record(latencyMs);
      recordTrustStateLatency({
        latencyMs,
        cacheStatus,
        outcome: res.statusCode >= 500 ? 'error' : 'success',
      });
    });

    try {
      // Try cache first
      const cached = await getCachedTrustState(npi);
      if (cached) {
        cacheStatus = 'hit';
        recordCacheLookup({
          source: 'trust_state_route',
          hit: true,
          context: { npi_prefix: npi.slice(0, 4) },
        });
        return res.status(200).json({ ...cached, cached: true });
      }

      cacheStatus = 'miss';
      recordCacheLookup({
        source: 'trust_state_route',
        hit: false,
        context: { npi_prefix: npi.slice(0, 4) },
      });

      // Miss — recompute via refresh so the snapshot is persisted and memory cache is primed.
      const resolverStartedAtMs = Date.now();
      const state = await refreshTrustState(npi);
      recordResolverRuntime({
        latencyMs: Date.now() - resolverStartedAtMs,
        band: toResolverBand(state.readiness_level),
        blockingReasonCount: state.gap_summary.length,
        startReady: state.readiness_level === 'L3',
      });
      return res.status(200).json({ ...state, cached: false });
    } catch (err) {
      log('error', 'trust_state_get_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to compute trust state' });
    }
  });

  /**
   * POST /api/trust-state/:npi/refresh
   * Forces recomputation and persists snapshot. Requires x-clerk-user-id header.
   */
  app.post('/api/trust-state/:npi/refresh', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const clerkUserId = req.headers['x-clerk-user-id'];

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    if (!clerkUserId) {
      return res.status(401).json({ error: 'Authentication required — x-clerk-user-id header missing' });
    }

    try {
      const state = await refreshTrustState(npi);
      return res.status(200).json({ ...state, cached: false });
    } catch (err) {
      log('error', 'trust_state_refresh_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to refresh trust state' });
    }
  });

  /**
   * GET /api/trust-state/:npi/history
   * Returns past trust state snapshots (most recent first).
   */
  app.get('/api/trust-state/:npi/history', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const limitRaw = req.query.limit;
    const limit = typeof limitRaw === 'string' ? Math.min(parseInt(limitRaw, 10) || 10, 50) : 10;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      const history = await getTrustStateHistory(npi, limit);
      return res.status(200).json({ npi, history, count: history.length });
    } catch (err) {
      log('error', 'trust_state_history_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to retrieve trust state history' });
    }
  });

  app.get('/api/trust-state/:npi/domain', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (!isValidNpi(npi)) {
      return res.status(400).json({ error: 'Invalid NPI — must be exactly 10 digits' });
    }

    try {
      const resolver = new TrustStateResolver(buildTrustStateResolverDeps());
      const state = await resolver.resolve(npi, readScope(req));
      return res.status(200).json(state);
    } catch (err) {
      log('error', 'trust_state_domain_get_error', { npi, error: String(err) });
      return res.status(500).json({ error: 'Failed to compute domain trust state' });
    }
  });

  /**
   * GET /api/trust-state/cache/stats
   * Wave 292: Cache integrity audit — LRU metrics, hit ratio breakdown, histogram snapshot.
   * Memory hits, DB hits, misses, overall hit ratio, p50/p90/p95 latency.
   */
  app.get('/api/trust-state/cache/stats', (_req: Request, res: Response) => {
    const cache = getCacheCounters();
    const telemetry = getPilotTelemetryDashboard();

    return res.status(200).json({
      schema: 'vitalcv.cache-stats.v1',
      generated_at: new Date().toISOString(),
      cache: {
        lru: {
          size: cache.lru_size,
          max: cache.lru_max,
          ttl_ms: cache.lru_ttl_ms,
          utilization: cache.lru_max > 0 ? +(cache.lru_size / cache.lru_max).toFixed(4) : 0,
        },
        hits: {
          memory: cache.memory_hits,
          db: cache.db_hits,
          total: cache.memory_hits + cache.db_hits,
        },
        misses: cache.misses,
        total_requests: cache.total_requests,
        ratios: {
          memory_hit: cache.memory_hit_ratio,
          db_hit: cache.db_hit_ratio,
          overall_hit: cache.overall_hit_ratio,
          miss: cache.total_requests > 0
            ? +(cache.misses / cache.total_requests).toFixed(4)
            : 0,
        },
      },
      latency: {
        trust_state: telemetry.metrics.trust_state_latency,
        widget_pas: telemetry.metrics.widget_pas_generation_time,
        resolver_runtime: telemetry.metrics.resolver_runtime,
        histogram: trustStateLatencyHistogram.snapshot(),
      },
      pilot_dashboard: telemetry.dashboard,
    });
  });
}
