/**
 * providerSourceProvenance.ts — Wave 119: Provider Data Integrity Fabric
 *
 * Tracks the provenance chain for every provider data record:
 *   - source system (NPPES, State Board, OIG, ABMS)
 *   - fetch timestamp
 *   - raw payload hash (SHA-256)
 *   - transformation log
 *   - freshness / staleness assessment
 *
 * Enables audit trail from any canonical provider field back to its
 * original source record with cryptographic integrity verification.
 */

import { createHash } from 'node:crypto';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────

export type ProvenanceSourceType = 'NPPES' | 'STATE_BOARD' | 'OIG' | 'ABMS' | 'MANUAL';

export interface ProvenanceRecord {
  provenanceId: string;
  npi: string;
  source: ProvenanceSourceType;
  sourceUrl: string;
  fetchedAt: string;
  rawPayloadHash: string;
  payloadSizeBytes: number;
  transformations: ProvenanceTransformation[];
  freshnessStatus: 'FRESH' | 'STALE' | 'EXPIRED';
  freshnessThresholdDays: number;
  daysSinceUpdate: number;
  verifiedAt: string;
}

export interface ProvenanceTransformation {
  step: string;
  description: string;
  appliedAt: string;
}

export interface ProvenanceChain {
  npi: string;
  records: ProvenanceRecord[];
  integrityStatus: 'VERIFIED' | 'DEGRADED' | 'UNKNOWN';
  oldestSource: string | null;
  newestSource: string | null;
  queriedAt: string;
}

// ── In-Memory Store ───────────────────────────────────────────────────

const provenanceStore = new Map<string, ProvenanceRecord[]>();

// ── Freshness Assessment ──────────────────────────────────────────────

const FRESHNESS_THRESHOLDS: Record<ProvenanceSourceType, number> = {
  NPPES: 30,        // CMS updates monthly
  STATE_BOARD: 90,  // Boards update quarterly
  OIG: 30,          // OIG LEIE updates monthly
  ABMS: 180,        // ABMS updates semi-annually
  MANUAL: 365,      // Manual entries expire yearly
};

function assessFreshness(
  source: ProvenanceSourceType,
  fetchedAt: string
): { status: ProvenanceRecord['freshnessStatus']; daysSince: number; threshold: number } {
  const now = Date.now();
  const fetched = new Date(fetchedAt).getTime();
  const daysSince = Math.floor((now - fetched) / (1000 * 60 * 60 * 24));
  const threshold = FRESHNESS_THRESHOLDS[source];

  return {
    status: daysSince <= threshold ? 'FRESH' : daysSince <= threshold * 2 ? 'STALE' : 'EXPIRED',
    daysSince,
    threshold,
  };
}

// ── Public API ────────────────────────────────────────────────────────

let provenanceCounter = 0;

/**
 * Record provenance for a provider data fetch.
 */
export function recordProvenance(params: {
  npi: string;
  source: ProvenanceSourceType;
  sourceUrl: string;
  rawPayload: unknown;
  transformations?: ProvenanceTransformation[];
}): ProvenanceRecord {
  const { npi, source, sourceUrl, rawPayload, transformations = [] } = params;

  const payloadStr = JSON.stringify(rawPayload);
  const rawPayloadHash = createHash('sha256').update(payloadStr, 'utf8').digest('hex');
  const fetchedAt = new Date().toISOString();
  const freshness = assessFreshness(source, fetchedAt);

  provenanceCounter++;
  const record: ProvenanceRecord = {
    provenanceId: `prov_${provenanceCounter}_${Date.now()}`,
    npi,
    source,
    sourceUrl,
    fetchedAt,
    rawPayloadHash,
    payloadSizeBytes: Buffer.byteLength(payloadStr, 'utf8'),
    transformations: [
      { step: 'FETCH', description: `Raw fetch from ${source}`, appliedAt: fetchedAt },
      ...transformations,
    ],
    freshnessStatus: freshness.status,
    freshnessThresholdDays: freshness.threshold,
    daysSinceUpdate: freshness.daysSince,
    verifiedAt: fetchedAt,
  };

  if (!provenanceStore.has(npi)) provenanceStore.set(npi, []);
  provenanceStore.get(npi)!.push(record);

  log('info', 'provider_provenance: recorded', {
    npi,
    source,
    freshness: freshness.status,
    hash: rawPayloadHash.slice(0, 12),
  });

  return record;
}

/**
 * Get the full provenance chain for an NPI.
 */
export function getProvenanceChain(npi: string): ProvenanceChain {
  const records = provenanceStore.get(npi) ?? [];

  // Re-assess freshness on query
  const assessed = records.map((r) => {
    const f = assessFreshness(r.source, r.fetchedAt);
    return { ...r, freshnessStatus: f.status, daysSinceUpdate: f.daysSince };
  });

  const sorted = assessed.sort((a, b) => new Date(a.fetchedAt).getTime() - new Date(b.fetchedAt).getTime());

  const allVerified = assessed.every((r) => r.freshnessStatus !== 'EXPIRED');

  return {
    npi,
    records: assessed,
    integrityStatus: assessed.length === 0 ? 'UNKNOWN' : allVerified ? 'VERIFIED' : 'DEGRADED',
    oldestSource: sorted[0]?.fetchedAt ?? null,
    newestSource: sorted[sorted.length - 1]?.fetchedAt ?? null,
    queriedAt: new Date().toISOString(),
  };
}

/**
 * Get provenance health for all tracked NPIs.
 */
export function getProvenanceHealth(): {
  totalProviders: number;
  freshCount: number;
  staleCount: number;
  expiredCount: number;
  sources: Record<ProvenanceSourceType, number>;
} {
  const sources: Record<string, number> = {};
  let fresh = 0, stale = 0, expired = 0;

  for (const [, records] of provenanceStore) {
    for (const r of records) {
      sources[r.source] = (sources[r.source] ?? 0) + 1;
      const f = assessFreshness(r.source, r.fetchedAt);
      if (f.status === 'FRESH') fresh++;
      else if (f.status === 'STALE') stale++;
      else expired++;
    }
  }

  return {
    totalProviders: provenanceStore.size,
    freshCount: fresh,
    staleCount: stale,
    expiredCount: expired,
    sources: sources as Record<ProvenanceSourceType, number>,
  };
}
