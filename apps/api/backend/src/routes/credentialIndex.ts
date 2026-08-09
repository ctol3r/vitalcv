/**
 * credentialIndex.ts — Wave Index
 *
 * GET /api/index/clinicians   — global credential readiness index
 * GET /api/index/stats        — aggregate index statistics
 *
 * The index is built from VerificationArtifact rows where source='TRUST_STATE_ENGINE'.
 * Each row represents the latest persisted trust state for a clinician.
 *
 * Metrics per clinician:
 *   - trustBand:             L0 | L1 | L2 | L3
 *   - readinessScore:        0–100
 *   - credentialCompleteness: % of facts with status VERIFIED (0–100)
 *   - verificationFreshness: age of trust state in hours (lower = fresher)
 *   - freshnessStatus:       'fresh' (<24h) | 'aging' (24–72h) | 'stale' (>72h)
 *
 * AUTHORIZATION (2026-08-08). Both routes were reachable by any anonymous
 * caller who set `x-org-id` to any value — they sit behind the global tenant
 * guard, which accepted mere PRESENCE of a caller-supplied org id, and neither
 * reads the org, so it was a turnstile token rather than a scope. Measured in
 * production: /api/index/clinicians returned 24 clinicians, 16 of them with
 * check-digit-valid NPIs (i.e. real registrants), each with a readiness score,
 * trust band and gap count. That is this platform's private assessment of a
 * named clinician's credential standing.
 *
 * Gated on the operator secret because there is no caller to preserve — no
 * reference to either path exists anywhere outside this file. If a product
 * surface later needs the index, the correct gate is a verified session, not
 * this one; operator-secret is the fail-closed holding position.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { requireInternalSecret } from '../middleware/internalSecret';
import { log } from '../obs/logger';
import type { ClinicianTrustState } from '../services/trust/trustStateEngine';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClinicianIndexEntry {
  npi: string;
  trustBand: 'L0' | 'L1' | 'L2' | 'L3';
  readinessScore: number;
  readinessStatus: string;
  credentialCompleteness: number;       // 0–100
  verificationFreshnessHours: number;   // hours since last computation
  freshnessStatus: 'fresh' | 'aging' | 'stale';
  verifiedFactCount: number;
  totalFactCount: number;
  gapCount: number;
  computedAt: string;                   // ISO
  passportUrl: string;
}

interface IndexStats {
  totalClinicians: number;
  byBand: Record<string, number>;
  avgReadinessScore: number;
  avgCompleteness: number;
  freshCount: number;        // computed < 24h ago
  agingCount: number;        // 24–72h
  staleCount: number;        // > 72h
  fullyVerifiedCount: number; // L3 GREEN
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<string, number> = { L3: 3, L2: 2, L1: 1, L0: 0 };

function extractTrustState(rawPayload: unknown): ClinicianTrustState | null {
  if (typeof rawPayload !== 'object' || rawPayload === null) return null;
  const p = rawPayload as Record<string, unknown>;

  // Handles both { trust_state_snapshot: {...} } and direct shape
  const candidate = p['trust_state_snapshot'] ?? p;
  if (
    typeof candidate === 'object' &&
    candidate !== null &&
    'readiness_level' in candidate &&
    'readiness_score' in candidate
  ) {
    return candidate as unknown as ClinicianTrustState;
  }
  return null;
}

function computeCompleteness(facts: ClinicianTrustState['facts']): number {
  if (!facts || facts.length === 0) return 0;
  const verified = facts.filter(f => f.status === 'VERIFIED' || f.status === 'verified').length;
  return Math.round((verified / facts.length) * 100);
}

function freshnessStatus(computedAt: string): 'fresh' | 'aging' | 'stale' {
  const ageHours = (Date.now() - new Date(computedAt).getTime()) / 3_600_000;
  if (ageHours < 24) return 'fresh';
  if (ageHours < 72) return 'aging';
  return 'stale';
}

function toIndexEntry(npi: string, state: ClinicianTrustState): ClinicianIndexEntry {
  const facts = state.facts ?? [];
  const verified = facts.filter(f => f.status === 'VERIFIED' || f.status === 'verified').length;
  const ageHours = Math.round((Date.now() - new Date(state.computedAt).getTime()) / 3_600_000);

  return {
    npi,
    trustBand:              (state.readiness_level ?? state.trustBand ?? 'L0') as ClinicianIndexEntry['trustBand'],
    readinessScore:         state.readiness_score ?? state.trustScore ?? 0,
    readinessStatus:        state.readiness_status ?? '',
    credentialCompleteness: computeCompleteness(facts),
    verificationFreshnessHours: ageHours,
    freshnessStatus:        freshnessStatus(state.computedAt),
    verifiedFactCount:      verified,
    totalFactCount:         facts.length,
    gapCount:               (state.gap_summary ?? []).length,
    computedAt:             state.computedAt,
    passportUrl:            `https://vitalcv.com/p/${npi}`,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export function registerCredentialIndexRoutes(app: Express): void {

  /**
   * GET /api/index/clinicians
   *
   * Global credential readiness index — all clinicians with persisted trust state.
   *
   * Query params:
   *   trustBand=L3           — filter by band (L0|L1|L2|L3, comma-separated)
   *   minScore=80            — minimum readiness score (0–100)
   *   maxScore=100           — maximum readiness score
   *   freshnessStatus=fresh  — filter by freshness (fresh|aging|stale)
   *   maxAgeDays=7           — only include states computed within N days
   *   minCompleteness=80     — minimum credential completeness %
   *   limit=100              — page size (max 500)
   *   offset=0               — pagination offset
   *   sort=score             — sort by: score|band|freshness|completeness (default: score desc)
   *   order=desc             — asc | desc
   */
  app.get('/api/index/clinicians', requireInternalSecret, async (req: Request, res: Response) => {
    const startMs = Date.now();

    // Parse filters
    const bandFilter = typeof req.query.trustBand === 'string'
      ? req.query.trustBand.split(',').map(b => b.trim().toUpperCase()).filter(Boolean)
      : null;
    const minScore     = Number(req.query.minScore ?? 0);
    const maxScore     = Number(req.query.maxScore ?? 100);
    const freshFilter  = typeof req.query.freshnessStatus === 'string' ? req.query.freshnessStatus : null;
    const maxAgeDays   = typeof req.query.maxAgeDays === 'string' ? Number(req.query.maxAgeDays) : null;
    const minComplete  = Number(req.query.minCompleteness ?? 0);
    const limit        = Math.min(Number(req.query.limit ?? 100), 500);
    const offset       = Number(req.query.offset ?? 0);
    const sortBy       = String(req.query.sort ?? 'score');
    const order        = String(req.query.order ?? 'desc') === 'asc' ? 'asc' : 'desc';

    try {
      // Fetch the latest trust state snapshot per NPI
      // Prisma distinct + orderBy gives us the most recent row per NPI
      const cutoff = maxAgeDays
        ? new Date(Date.now() - maxAgeDays * 86_400_000)
        : undefined;

      const rows = await prisma.verificationArtifact.findMany({
        where: {
          source: 'TRUST_STATE_ENGINE',
          ...(cutoff ? { verifiedAt: { gte: cutoff } } : {}),
        },
        distinct: ['npi'],
        orderBy: { verifiedAt: 'desc' },
        select: { npi: true, rawPayload: true, verifiedAt: true },
      });

      // Extract and build index entries
      let entries: ClinicianIndexEntry[] = [];
      for (const row of rows) {
        const state = extractTrustState(row.rawPayload);
        if (!state) continue;
        entries.push(toIndexEntry(row.npi, state));
      }

      // Apply filters
      if (bandFilter?.length) {
        entries = entries.filter(e => bandFilter.includes(e.trustBand));
      }
      if (minScore > 0) entries = entries.filter(e => e.readinessScore >= minScore);
      if (maxScore < 100) entries = entries.filter(e => e.readinessScore <= maxScore);
      if (freshFilter) entries = entries.filter(e => e.freshnessStatus === freshFilter);
      if (minComplete > 0) entries = entries.filter(e => e.credentialCompleteness >= minComplete);

      // Sort
      entries.sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'band') cmp = (LEVEL_ORDER[b.trustBand] ?? 0) - (LEVEL_ORDER[a.trustBand] ?? 0);
        else if (sortBy === 'freshness') cmp = a.verificationFreshnessHours - b.verificationFreshnessHours;
        else if (sortBy === 'completeness') cmp = b.credentialCompleteness - a.credentialCompleteness;
        else cmp = b.readinessScore - a.readinessScore; // default: score desc
        return order === 'asc' ? -cmp : cmp;
      });

      const total = entries.length;
      const page  = entries.slice(offset, offset + limit);

      log('info', 'credential_index: query', {
        total,
        returned: page.length,
        filters: { bandFilter, minScore, freshFilter },
        latencyMs: Date.now() - startMs,
      });

      res.json({
        total,
        limit,
        offset,
        returned: page.length,
        generatedAt: new Date().toISOString(),
        latencyMs: Date.now() - startMs,
        clinicians: page,
      });

    } catch (err) {
      log('error', 'credential_index: query failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to build credential readiness index' });
    }
  });

  /**
   * GET /api/index/stats
   * Aggregate statistics across the entire index.
   */
  app.get('/api/index/stats', requireInternalSecret, async (req: Request, res: Response) => {
    try {
      const rows = await prisma.verificationArtifact.findMany({
        where: { source: 'TRUST_STATE_ENGINE' },
        distinct: ['npi'],
        orderBy: { verifiedAt: 'desc' },
        select: { npi: true, rawPayload: true },
      });

      const entries: ClinicianIndexEntry[] = [];
      for (const row of rows) {
        const state = extractTrustState(row.rawPayload);
        if (state) entries.push(toIndexEntry(row.npi, state));
      }

      const byBand: Record<string, number> = { L0: 0, L1: 0, L2: 0, L3: 0 };
      let totalScore = 0, totalComplete = 0;
      let freshCount = 0, agingCount = 0, staleCount = 0;

      for (const e of entries) {
        byBand[e.trustBand] = (byBand[e.trustBand] ?? 0) + 1;
        totalScore   += e.readinessScore;
        totalComplete += e.credentialCompleteness;
        if (e.freshnessStatus === 'fresh')  freshCount++;
        else if (e.freshnessStatus === 'aging') agingCount++;
        else staleCount++;
      }

      const n = entries.length || 1;
      const stats: IndexStats = {
        totalClinicians:    entries.length,
        byBand,
        avgReadinessScore:  Math.round(totalScore / n),
        avgCompleteness:    Math.round(totalComplete / n),
        freshCount,
        agingCount,
        staleCount,
        fullyVerifiedCount: byBand['L3'] ?? 0,
        generatedAt:        new Date().toISOString(),
      };

      res.json(stats);
    } catch (err) {
      log('error', 'credential_index: stats failed', { error: String(err) });
      res.status(500).json({ error: 'Failed to compute index statistics' });
    }
  });
}
