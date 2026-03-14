/**
 * domainVerificationEngine.ts — Universal Domain Verification
 *
 * Runs verification for any registered domain. The pipeline:
 *   1. Resolve domain definition
 *   2. Run each verification source in parallel
 *   3. Persist results as VerificationArtifacts (same table, domain-namespaced source)
 *   4. Compute trust state using domain-specific scoring weights
 *   5. Return structured trust state + gap analysis
 *
 * Source execution:
 *   - If envFlag is set → live API call (adapter per source)
 *   - Otherwise → stub with deterministic behavior
 *   - Healthcare domain routes to existing PSV/trustStateEngine infrastructure
 */

import { createHash } from 'node:crypto';
import prisma from '../../graphql/prisma_client';
import { getCachedTrustState } from '../trust/trustStateEngine';
import { getDomain, type DomainDefinition, type VerificationSourceSpec } from './domainRegistry';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';

export interface DomainSourceResult {
  sourceId:       string;
  sourceLabel:    string;
  credentialTypes: string[];
  status:         'VERIFIED' | 'ACTIVE' | 'NOT_FOUND' | 'EXPIRED' | 'FAILED' | 'STUB';
  live:           boolean;
  verifiedAt:     string;
  latencyMs:      number;
  data:           Record<string, unknown>;
  artifactId:     string | null;
}

export interface DomainTrustState {
  domain:          string;
  domainName:      string;
  subjectId:       string;
  trustBand:       TrustBand;
  trustScore:      number;
  readinessStatus: string;
  credentialTypes: Array<{
    id: string; label: string; required: boolean;
    present: boolean; status: string; contribution: number;
  }>;
  gaps:           string[];
  sources:        DomainSourceResult[];
  computedAt:     string;
  methodology:    string;
}

// ── Scoring ───────────────────────────────────────────────────────────────────

function computeDomainScore(
  domain: DomainDefinition,
  presentCredentialTypes: Set<string>,
): number {
  let score = 0;
  for (const cred of domain.credentialTypes) {
    if (presentCredentialTypes.has(cred.id)) {
      score += cred.scoreContribution;
    }
  }
  return Math.min(100, score);
}

function deriveBand(score: number, blocked: boolean): TrustBand {
  if (blocked || score < 25) return 'L0';
  if (score < 50) return 'L1';
  if (score < 75) return 'L2';
  return 'L3';
}

function computeGaps(
  domain: DomainDefinition,
  presentCredentialTypes: Set<string>,
  sourceResults: DomainSourceResult[],
): string[] {
  const gaps: string[] = [];
  const failedSources = sourceResults.filter(r => r.status === 'FAILED' || r.status === 'NOT_FOUND');
  const verifiedSources = new Set(sourceResults.filter(r => r.status === 'VERIFIED' || r.status === 'ACTIVE').map(r => r.sourceId));

  for (const cred of domain.credentialTypes) {
    if (cred.required && !presentCredentialTypes.has(cred.id)) {
      gaps.push(`Required credential missing: ${cred.label}`);
    }
  }
  for (const src of failedSources) {
    gaps.push(`Verification source unavailable: ${src.sourceLabel} — ${src.status}`);
  }
  if (verifiedSources.size === 0) {
    gaps.push('No credentials verified against primary sources');
  }
  return gaps;
}

// ── Source adapters ───────────────────────────────────────────────────────────

async function runSource(
  source: VerificationSourceSpec,
  subjectId: string,
  domain: DomainDefinition,
): Promise<DomainSourceResult> {
  const start = Date.now();
  const isLive = process.env[source.envFlag] === 'true';

  if (!isLive) {
    // Deterministic stub — stable result for this subjectId+source combination
    const hash = createHash('sha256').update(`${domain.id}:${source.id}:${subjectId}`).digest('hex');
    const stubVerified = source.stubBehavior === 'PASS' || parseInt(hash.slice(0, 2), 16) > 80;

    return {
      sourceId:       source.id,
      sourceLabel:    source.label,
      credentialTypes: source.credentialTypes,
      status:         stubVerified ? 'STUB' : 'NOT_FOUND',
      live:           false,
      verifiedAt:     new Date().toISOString(),
      latencyMs:      0,
      data:           { stub: true, deterministic: hash.slice(0, 8) },
      artifactId:     null,
    };
  }

  // Live adapter routing — domain:source combos
  try {
    const result = await runLiveAdapter(source, subjectId, domain);
    return { ...result, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      sourceId: source.id, sourceLabel: source.label,
      credentialTypes: source.credentialTypes,
      status: 'FAILED', live: true,
      verifiedAt: new Date().toISOString(), latencyMs: Date.now() - start,
      data: { error: String(err) }, artifactId: null,
    };
  }
}

async function runLiveAdapter(
  source: VerificationSourceSpec,
  subjectId: string,
  domain: DomainDefinition,
): Promise<Omit<DomainSourceResult, 'latencyMs'>> {
  // Healthcare → existing NPPES/OIG live infrastructure
  if (domain.id === 'healthcare' && source.id === 'NPPES') {
    const resp = await fetch(`https://npiregistry.cms.hhs.gov/api/?version=2.1&number=${subjectId}`);
    const data = await resp.json() as { results?: unknown[]; result_count?: number };
    const found = (data.result_count ?? 0) > 0;
    return {
      sourceId: source.id, sourceLabel: source.label,
      credentialTypes: source.credentialTypes,
      status: found ? 'VERIFIED' : 'NOT_FOUND', live: true,
      verifiedAt: new Date().toISOString(),
      data: found ? { npi: subjectId, source: 'NPPES_LIVE' } : {},
      artifactId: null,
    };
  }

  // Default: not yet implemented — return graceful unknown
  return {
    sourceId: source.id, sourceLabel: source.label,
    credentialTypes: source.credentialTypes,
    status: 'NOT_FOUND', live: true,
    verifiedAt: new Date().toISOString(),
    data: { note: `Live adapter for ${domain.id}:${source.id} not yet implemented` },
    artifactId: null,
  };
}

// ── Persist artifacts ─────────────────────────────────────────────────────────

async function persistDomainArtifact(
  domainId: string,
  subjectId: string,
  result: DomainSourceResult,
): Promise<string | null> {
  if (result.status === 'STUB') return null; // don't persist stubs

  const rawPayload = {
    domain:         domainId,
    subjectId,
    sourceId:       result.sourceId,
    credentialTypes: result.credentialTypes,
    status:         result.status,
    live:           result.live,
    verifiedAt:     result.verifiedAt,
    data:           result.data,
  };

  const checksum = createHash('sha256')
    .update(JSON.stringify({ domainId, subjectId, source: result.sourceId, verifiedAt: result.verifiedAt }))
    .digest('hex');

  try {
    const existing = await prisma.verificationArtifact.findFirst({
      where: { checksum },
      select: { id: true },
    });
    let artifactId: string;
    if (existing) {
      await prisma.verificationArtifact.update({
        where: { id: existing.id },
        data: { status: result.status, rawPayload: JSON.parse(JSON.stringify(rawPayload)), lifecycleState: 'active', verifiedAt: new Date() },
      });
      artifactId = existing.id;
    } else {
      const created = await prisma.verificationArtifact.create({
        data: {
          npi: subjectId, source: `${domainId.toUpperCase()}_${result.sourceId}`,
          status: result.status, rawPayload: JSON.parse(JSON.stringify(rawPayload)),
          checksum, merkleRoot: null, lifecycleState: 'active', verifiedAt: new Date(),
        },
        select: { id: true },
      });
      artifactId = created.id;
    }
    return artifactId;
  } catch {
    return null;
  }
}

// ── Main verification function ────────────────────────────────────────────────

export async function verifyDomainProfessional(
  domainId: string,
  subjectId: string,
): Promise<DomainTrustState> {
  const domain = getDomain(domainId);
  if (!domain) throw new Error(`Unknown domain: ${domainId}`);

  const computedAt = new Date().toISOString();

  // For healthcare, delegate to the full existing trust engine
  if (domain.id === 'healthcare') {
    const existing = await getCachedTrustState(subjectId).catch(() => null);
    if (existing) {
      return {
        domain: domain.id, domainName: domain.name, subjectId,
        trustBand:       (existing.readiness_level ?? existing.trustBand ?? 'L0') as TrustBand,
        trustScore:      existing.readiness_score ?? existing.trustScore ?? 0,
        readinessStatus: existing.readiness_status ?? 'Healthcare trust state',
        credentialTypes: domain.credentialTypes.map(c => ({
          id: c.id, label: c.label, required: c.required,
          present: false, status: 'DELEGATED_TO_HEALTHCARE_ENGINE', contribution: c.scoreContribution,
        })),
        gaps:        existing.gap_summary ?? [],
        sources:     [],
        computedAt,
        methodology: `healthcare.trustStateEngine.v243 | domain.v${domain.version}`,
      };
    }
  }

  // Run all sources in parallel
  const sourceResults = await Promise.allSettled(
    domain.sources.map(s => runSource(s, subjectId, domain))
  );
  const results: DomainSourceResult[] = [];
  for (const r of sourceResults) {
    if (r.status === 'fulfilled') results.push(r.value);
  }

  // Persist live results
  for (const r of results) {
    const aid = await persistDomainArtifact(domainId, subjectId, r);
    if (aid) r.artifactId = aid;
  }

  // Determine which credential types are satisfied
  const presentTypes = new Set<string>();
  for (const r of results) {
    if (r.status === 'VERIFIED' || r.status === 'ACTIVE') {
      for (const ct of r.credentialTypes) presentTypes.add(ct);
    }
  }

  // Check hard blockers
  const blocked = results.some(r =>
    domain.hardBlockers.some(b => r.data?.blockType === b || r.data?.status === b)
  );

  const trustScore = computeDomainScore(domain, presentTypes);
  const trustBand  = deriveBand(trustScore, blocked);
  const gaps       = computeGaps(domain, presentTypes, results);

  const readinessLabels = domain.trustBandLabels;
  const readinessStatus = readinessLabels[trustBand];

  log('info', 'domainVerification: complete', {
    domain: domainId, subjectId, trustBand, trustScore,
    sourcesRun: results.length, liveCount: results.filter(r => r.live).length,
  });

  return {
    domain: domain.id, domainName: domain.name, subjectId,
    trustBand, trustScore, readinessStatus,
    credentialTypes: domain.credentialTypes.map(c => ({
      id:           c.id,
      label:        c.label,
      required:     c.required,
      present:      presentTypes.has(c.id),
      status:       presentTypes.has(c.id) ? 'VERIFIED' : 'MISSING',
      contribution: presentTypes.has(c.id) ? c.scoreContribution : 0,
    })),
    gaps,
    sources: results,
    computedAt,
    methodology: `domain.v${domain.version} | scoring.v1`,
  };
}

// ── Domain comparison (cross-domain credential equivalence) ───────────────────

export interface DomainEquivalence {
  subjectId:    string;
  domains:      string[];
  states:       Record<string, { trustBand: TrustBand; trustScore: number }>;
  highestBand:  TrustBand;
  lowestBand:   TrustBand;
  universalScore: number;
}

export async function getMultiDomainStatus(
  subjectId: string,
  domains: string[],
): Promise<DomainEquivalence> {
  const states = await Promise.allSettled(
    domains.map(async d => ({ domain: d, state: await verifyDomainProfessional(d, subjectId) }))
  );

  const stateMap: DomainEquivalence['states'] = {};
  const BAND_ORDER: Record<TrustBand, number> = { L0: 0, L1: 1, L2: 2, L3: 3 };

  for (const r of states) {
    if (r.status === 'fulfilled') {
      stateMap[r.value.domain] = {
        trustBand:  r.value.state.trustBand,
        trustScore: r.value.state.trustScore,
      };
    }
  }

  const bands = Object.values(stateMap).map(s => s.trustBand);
  const scores = Object.values(stateMap).map(s => s.trustScore);

  const highestBand = bands.reduce((a, b) => BAND_ORDER[a] > BAND_ORDER[b] ? a : b, 'L0' as TrustBand);
  const lowestBand  = bands.reduce((a, b) => BAND_ORDER[a] < BAND_ORDER[b] ? a : b, 'L3' as TrustBand);
  const universalScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return { subjectId, domains, states: stateMap, highestBand, lowestBand, universalScore };
}
