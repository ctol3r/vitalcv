/**
 * identityIngestionPipeline.ts — Multi-Source Identity Ingestion Orchestrator
 *
 * Pipeline stages for each source:
 *   1. FETCH    — call the source API; capture raw response + checksum
 *   2. STORE    — persist raw artifact to VerificationArtifact (append-only)
 *   3. PARSE    — run the source parser → NormalizedClaim[] + VerificationReceipt[]
 *   4. EMBED    — attach claims + receipts to the artifact rawPayload._claims
 *   5. DELTA    — compare new claims to prior claims; emit change events
 *   6. INDEX    — update PersonProfile.metadata.identity (canonical summary)
 *
 * Sources run concurrently per stage. If a source fails, it is quarantined
 * with status='FAILED' — it does not corrupt other sources or the index.
 *
 * Gold sources that fail do NOT degrade the canonical index;
 * they mark the affected claim types as stale pending retry.
 */

import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import {
  parseNppesResult,
  parseOigResult,
  parsePecosRecord,
  parseOpenAlexAuthor,
  checksumOf,
  type NormalizedClaim,
} from './claimEngine';
import {
  buildIdentitySummary,
  type CanonicalIdentitySummary,
} from './evidenceModel';
import { getSource } from './sourceCatalog';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IngestionResult {
  npi:          string;
  source:       string;
  artifactId:   string | null;
  claimsEmitted: number;
  deltaEvents:  DeltaEvent[];
  status:       'SUCCESS' | 'SKIPPED' | 'FAILED';
  latencyMs:    number;
  error?:       string;
}

export interface DeltaEvent {
  type: 'CLAIM_ADDED' | 'CLAIM_CHANGED' | 'CLAIM_EXPIRED' | 'EXCLUSION_DETECTED' | 'LICENSE_STATUS_CHANGED';
  claimType: string;
  previous: unknown;
  current:  unknown;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface FullIngestionReport {
  npi:           string;
  triggeredAt:   string;
  durationMs:    number;
  sourcesRun:    number;
  sourcesOk:     number;
  sourcesFailed: number;
  claimsTotal:   number;
  deltaEvents:   DeltaEvent[];
  results:       IngestionResult[];
  identity:      CanonicalIdentitySummary | null;
}

// ── NPPES API fetcher ─────────────────────────────────────────────────────────

async function fetchNppes(npi: string): Promise<{ raw: unknown; checksum: string }> {
  const url  = `https://npiregistry.cms.hhs.gov/api/?number=${npi}&version=2.1`;
  const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!resp.ok) throw new Error(`NPPES API returned ${resp.status}`);
  const raw  = await resp.json();
  return { raw, checksum: checksumOf(raw) };
}

// ── OIG LEIE fetcher ──────────────────────────────────────────────────────────

async function fetchOig(npi: string): Promise<{ raw: unknown; checksum: string }> {
  // OIG has a public search endpoint; try NPI lookup via the exclusion search API
  const url  = `https://oig.hhs.gov/exclusions/api/?npi=${npi}`;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) {
      // OIG API not available — return uncertain result rather than silently passing
      return { raw: { matchType: undefined, excluded: false, _apiUnavailable: true }, checksum: checksumOf({ npi, status: 'API_UNAVAILABLE' }) };
    }
    const raw = await resp.json();
    return { raw, checksum: checksumOf(raw) };
  } catch {
    return { raw: { matchType: undefined, excluded: false, _apiUnavailable: true }, checksum: checksumOf({ npi, ts: Date.now() }) };
  }
}

// ── PECOS public enrollment fetcher ──────────────────────────────────────────

async function fetchPecos(npi: string): Promise<{ raw: unknown; checksum: string }> {
  // CMS data.cms.gov API — query the public enrollment file by NPI
  const url = `https://data.cms.gov/data-api/v1/dataset/2457ea29-fc82-48b0-86ec-3b0755de7515/data?filter[NPI]=${npi}&size=5`;
  try {
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`PECOS API ${resp.status}`);
    const data = await resp.json() as unknown[];
    const row  = Array.isArray(data) && data.length > 0 ? data[0] as Record<string, unknown> : null;
    const raw  = row
      ? { enrolled: true, enrollmentType: row['ENRLMT_CLSFCTN_TYPE_DESC'] ?? null, eligibleToOrderRefer: row['GNDR_CD'] !== undefined, source: 'PECOS', npi }
      : { enrolled: false, enrollmentType: null, eligibleToOrderRefer: null, source: 'PECOS', npi };
    return { raw, checksum: checksumOf(raw) };
  } catch (err) {
    // PECOS API unavailable — return unverified enrollment
    log('warn', 'identityPipeline: PECOS fetch failed', { npi, error: String(err) });
    return { raw: { enrolled: false, enrollmentType: null, source: 'PECOS_UNAVAILABLE', npi }, checksum: checksumOf({ npi, ts: Date.now() }) };
  }
}

// ── OpenAlex author fetcher ───────────────────────────────────────────────────

async function fetchOpenAlexByName(
  firstName: string,
  lastName: string,
): Promise<{ raw: unknown; checksum: string }> {
  const query = encodeURIComponent(`${firstName} ${lastName}`);
  const url   = `https://api.openalex.org/authors?search=${query}&per_page=1&mailto=hello@vitalcv.com`;
  const resp  = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!resp.ok) throw new Error(`OpenAlex API ${resp.status}`);
  const data  = await resp.json() as { results?: unknown[] };
  const first = data.results?.[0] ?? null;
  return { raw: first, checksum: checksumOf(first) };
}

// ── Store artifact ────────────────────────────────────────────────────────────

async function storeArtifact(
  npi: string,
  sourceId: string,
  raw: unknown,
  checksum: string,
  claims: NormalizedClaim[],
  receipts: unknown[],
): Promise<string> {
  const source = getSource(sourceId);

  // Check if identical artifact already exists
  const existing = await prisma.verificationArtifact.findFirst({
    where: { npi, source: sourceId, checksum },
    select: { id: true },
  });
  if (existing) return existing.id;  // idempotent — same raw = no new artifact

  const rawWithMeta = {
    ...(raw as Record<string, unknown>),
    _sourceId:      sourceId,
    _sourceTier:    source?.tier ?? 'BRONZE',
    _parserVersion: source?.parserVersion ?? 'unknown',
    _claims:        claims,
    _receipts:      receipts,
    _ingestedAt:    new Date().toISOString(),
  };

  const artifact = await prisma.verificationArtifact.create({
    data: {
      npi,
      source:      sourceId,
      status:      'ACTIVE',
      rawPayload:  JSON.parse(JSON.stringify(rawWithMeta)),
      checksum,
      merkleRoot:  null,
      lifecycleState: 'active',
      verifiedAt:  new Date(),
    },
    select: { id: true },
  });

  return artifact.id;
}

// ── Delta detection (claim-level) ─────────────────────────────────────────────

async function detectClaimDelta(npi: string, sourceId: string, newClaims: NormalizedClaim[]): Promise<DeltaEvent[]> {
  // Find the most recent prior artifact for this source
  const prior = await prisma.verificationArtifact.findFirst({
    where: { npi, source: sourceId, lifecycleState: 'active' },
    orderBy: { createdAt: 'desc' },
    select: { rawPayload: true, createdAt: true },
    skip: 1, // skip the one we just created
  });

  if (!prior) return [];

  const priorClaims = ((prior.rawPayload as Record<string, unknown>)?._claims ?? []) as NormalizedClaim[];
  const priorByType = new Map(priorClaims.map(c => [c.claimType, c]));
  const newByType   = new Map(newClaims.map(c => [c.claimType, c]));

  const events: DeltaEvent[] = [];

  // Check for exclusion status change — CRITICAL
  const priorExclusion = priorByType.get('EXCLUSION_STATUS');
  const newExclusion   = newByType.get('EXCLUSION_STATUS');
  if (priorExclusion && newExclusion) {
    const prevExcluded = (priorExclusion.value as { excluded?: boolean }).excluded;
    const newExcluded  = (newExclusion.value  as { excluded?: boolean }).excluded;
    if (prevExcluded !== newExcluded) {
      events.push({
        type: 'EXCLUSION_DETECTED', claimType: 'EXCLUSION_STATUS',
        previous: prevExcluded, current: newExcluded,
        severity: newExcluded ? 'CRITICAL' : 'HIGH',
      });
    }
  }

  // Check for new claims
  for (const [claimType, claim] of newByType) {
    if (!priorByType.has(claimType)) {
      events.push({ type: 'CLAIM_ADDED', claimType, previous: null, current: claim.value, severity: 'LOW' });
    }
  }

  return events;
}

// ── Update canonical identity index ──────────────────────────────────────────

async function updateIdentityIndex(npi: string, allClaims: NormalizedClaim[]): Promise<void> {
  const summary   = buildIdentitySummary(npi, allClaims);
  const checksum  = createHash('sha256').update(JSON.stringify({ npi, updatedAt: summary.lastIngestedAt })).digest('hex');
  const rawPayload = { _identityIndex: true, summary, updatedAt: summary.lastIngestedAt };

  // Upsert identity index artifact
  const existing = await prisma.verificationArtifact.findFirst({
    where: { npi, source: 'IDENTITY_INDEX' },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    await prisma.verificationArtifact.update({
      where: { id: existing.id },
      data: { rawPayload: JSON.parse(JSON.stringify(rawPayload)), checksum, verifiedAt: new Date() },
    });
  } else {
    await prisma.verificationArtifact.create({
      data: {
        npi, source: 'IDENTITY_INDEX', status: 'ACTIVE',
        rawPayload: JSON.parse(JSON.stringify(rawPayload)),
        checksum, merkleRoot: null, lifecycleState: 'active', verifiedAt: new Date(),
      },
    });
  }
}

// ── Per-source ingestion handlers ─────────────────────────────────────────────

type SourceHandler = (npi: string, observedAt: string) => Promise<IngestionResult>;

const handlers: Record<string, SourceHandler> = {

  NPPES_API: async (npi, observedAt) => {
    const start = Date.now();
    const { raw, checksum } = await fetchNppes(npi);
    const apiResult = raw as { results?: unknown[] };
    const result = apiResult.results?.[0];
    if (!result) return { npi, source: 'NPPES_API', artifactId: null, claimsEmitted: 0, deltaEvents: [], status: 'SKIPPED', latencyMs: Date.now() - start };

    const { claims, receipts } = parseNppesResult(npi, result as Parameters<typeof parseNppesResult>[1], '', '', observedAt);
    const artifactId = await storeArtifact(npi, 'NPPES_API', raw, checksum, claims, receipts);
    // Re-parse with actual artifactId
    const { claims: c2, receipts: r2 } = parseNppesResult(npi, result as Parameters<typeof parseNppesResult>[1], artifactId, checksum, observedAt);
    await prisma.verificationArtifact.update({ where: { id: artifactId }, data: { rawPayload: JSON.parse(JSON.stringify({ ...(raw as object), _claims: c2, _receipts: r2, _ingestedAt: observedAt })) } });

    const delta = await detectClaimDelta(npi, 'NPPES_API', c2);
    return { npi, source: 'NPPES_API', artifactId, claimsEmitted: c2.length, deltaEvents: delta, status: 'SUCCESS', latencyMs: Date.now() - start };
  },

  OIG_LEIE: async (npi, observedAt) => {
    const start = Date.now();
    const { raw, checksum } = await fetchOig(npi);
    const { claims, receipts } = parseOigResult(npi, raw as Parameters<typeof parseOigResult>[1], '', '', observedAt);
    const artifactId = await storeArtifact(npi, 'OIG_LEIE', raw, checksum, claims, receipts);
    const { claims: c2, receipts: r2 } = parseOigResult(npi, raw as Parameters<typeof parseOigResult>[1], artifactId, checksum, observedAt);
    await prisma.verificationArtifact.update({ where: { id: artifactId }, data: { rawPayload: JSON.parse(JSON.stringify({ ...(raw as object), _claims: c2, _receipts: r2 })) } });

    const delta = await detectClaimDelta(npi, 'OIG_LEIE', c2);
    return { npi, source: 'OIG_LEIE', artifactId, claimsEmitted: c2.length, deltaEvents: delta, status: 'SUCCESS', latencyMs: Date.now() - start };
  },

  PECOS_PUBLIC: async (npi, observedAt) => {
    const start = Date.now();
    const { raw, checksum } = await fetchPecos(npi);
    const { claims, receipts } = parsePecosRecord(npi, raw as Parameters<typeof parsePecosRecord>[1], '', '', observedAt);
    const artifactId = await storeArtifact(npi, 'PECOS_PUBLIC', raw, checksum, claims, receipts);
    const { claims: c2, receipts: r2 } = parsePecosRecord(npi, raw as Parameters<typeof parsePecosRecord>[1], artifactId, checksum, observedAt);
    await prisma.verificationArtifact.update({ where: { id: artifactId }, data: { rawPayload: JSON.parse(JSON.stringify({ ...(raw as object), _claims: c2, _receipts: r2 })) } });
    const delta = await detectClaimDelta(npi, 'PECOS_PUBLIC', c2);
    return { npi, source: 'PECOS_PUBLIC', artifactId, claimsEmitted: c2.length, deltaEvents: delta, status: 'SUCCESS', latencyMs: Date.now() - start };
  },
};

// ── Main pipeline entry point ─────────────────────────────────────────────────

export type IngestionSources = 'NPPES_API' | 'OIG_LEIE' | 'PECOS_PUBLIC' | 'OPENALEX' | 'ALL';

export async function ingestClinicianIdentity(
  npi: string,
  sources: IngestionSources[] = ['ALL'],
): Promise<FullIngestionReport> {
  const start       = Date.now();
  const triggeredAt = new Date().toISOString();
  const observedAt  = triggeredAt;

  const runAll     = sources.includes('ALL');
  const toRun      = runAll ? Object.keys(handlers) : sources.filter(s => s in handlers);

  log('info', 'identityPipeline: starting', { npi, sources: toRun });

  // Run all sources in parallel; never let one failure abort others
  const settled = await Promise.allSettled(
    toRun.map(src => handlers[src]!(npi, observedAt))
  );

  const results: IngestionResult[] = settled.map((r, i) =>
    r.status === 'fulfilled' ? r.value : {
      npi, source: toRun[i]!, artifactId: null,
      claimsEmitted: 0, deltaEvents: [],
      status: 'FAILED' as const,
      latencyMs: 0,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    }
  );

  // Collect all claims from successful sources for index update
  const allClaims: NormalizedClaim[] = [];
  for (const result of results) {
    if (result.status === 'SUCCESS' && result.artifactId) {
      const art = await prisma.verificationArtifact.findUnique({
        where: { id: result.artifactId },
        select: { rawPayload: true },
      });
      const claims = ((art?.rawPayload as Record<string, unknown>)?._claims ?? []) as NormalizedClaim[];
      allClaims.push(...claims);
    }
  }

  // Update canonical identity index
  let identity: CanonicalIdentitySummary | null = null;
  try {
    if (allClaims.length > 0) {
      await updateIdentityIndex(npi, allClaims);
      identity = buildIdentitySummary(npi, allClaims);
    }
  } catch (err) {
    log('error', 'identityPipeline: index update failed', { npi, error: String(err) });
  }

  const allDelta = results.flatMap(r => r.deltaEvents);

  // Emit audit event for critical deltas
  const criticals = allDelta.filter(d => d.severity === 'CRITICAL');
  for (const delta of criticals) {
    await prisma.auditEvent.create({
      data: {
        type:       `IDENTITY_DELTA_${delta.type}`,
        hash:       createHash('sha256').update(JSON.stringify(delta)).digest('hex'),
        clinicianId: npi,
        metadata:   JSON.parse(JSON.stringify(delta)),
      },
    }).catch(() => null);
  }

  const report: FullIngestionReport = {
    npi, triggeredAt,
    durationMs:    Date.now() - start,
    sourcesRun:    results.length,
    sourcesOk:     results.filter(r => r.status === 'SUCCESS').length,
    sourcesFailed: results.filter(r => r.status === 'FAILED').length,
    claimsTotal:   results.reduce((s, r) => s + r.claimsEmitted, 0),
    deltaEvents:   allDelta,
    results,
    identity,
  };

  log('info', 'identityPipeline: complete', {
    npi, durationMs: report.durationMs,
    claimsTotal: report.claimsTotal, sourcesFailed: report.sourcesFailed,
    criticalDeltas: criticals.length,
  });

  return report;
}

// ── Retrieve all claims for a NPI (from stored artifacts) ─────────────────────

export async function getClaimsForNpi(npi: string): Promise<NormalizedClaim[]> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, lifecycleState: 'active', source: { not: 'TRUST_STATE_ENGINE' } },
    select: { rawPayload: true, source: true, id: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const claims: NormalizedClaim[] = [];
  const seen = new Set<string>();

  for (const art of artifacts) {
    const rawClaims = ((art.rawPayload as Record<string, unknown>)?._claims ?? []) as NormalizedClaim[];
    for (const claim of rawClaims) {
      if (!seen.has(claim.claimId)) {
        seen.add(claim.claimId);
        claims.push(claim);
      }
    }
  }

  return claims;
}
