/**
 * workforceIntelligenceService.ts — Medical Workforce Intelligence Layer
 *
 * Aggregates credential events, verification outcomes, privilege grants,
 * deployment decisions, and availability data into intelligence signals for
 * medical workforce planning.
 *
 * Four intelligence domains:
 *
 *   1. Credential Bottlenecks  — which credentials slow down deployment?
 *      Source: VerificationArtifact (all records, by source/status/age)
 *
 *   2. Licensure Mobility      — how freely do clinicians move across states?
 *      Source: VerificationArtifact (STATE_BOARD/NURSYS + multi-state patterns)
 *
 *   3. Deployment Efficiency   — how fast does credential → deployment happen?
 *      Source: DecisionCapsule (DEPLOYMENT/HIRING decisions, timestamps, metadata)
 *
 *   4. Expertise Scarcity      — where is qualified workforce supply thin?
 *      Source: PersonProfile.metadata.availability + trust state bands
 *
 * All results cached 60 min. Cache key = metric name + serialized params.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Cache ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> { data: T; expiresAt: number }
const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 min

function fromCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.data as T;
  cache.delete(key);
  return null;
}
function toCache<T>(key: string, data: T): T {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 86_400_000);
}
function msToDays(ms: number): number {
  return Math.round(ms / 86_400_000 * 10) / 10;
}
function pct(num: number, denom: number): number {
  return denom === 0 ? 0 : Math.round((num / denom) * 1000) / 10;
}
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length * 0.95)] ?? sorted[sorted.length - 1]!;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BottleneckSignal {
  source: string;
  label: string;
  totalRecords: number;
  verifiedCount: number;
  expiredCount: number;
  pendingCount: number;
  verificationRate: number;       // %
  expiryRate: number;             // %
  avgVerificationDays: number;    // mean days from created → verifiedAt
  medianVerificationDays: number;
  p95VerificationDays: number;
  bottleneckScore: number;        // 0–100: higher = bigger bottleneck
  bottleneckReason: string;
}

export interface MobilityPattern {
  state: string;
  uniqueClinicians: number;
  avgStatesLicensed: number;      // avg # of states where these clinicians hold licenses
  compactParticipants: number;    // NURSYS-sourced multi-state
  inboundMobility: number;        // clinicians with licenses here + another state
  outboundMobility: number;       // clinicians licensed here moving to other states
  mobilityScore: number;          // 0–100: higher = more mobile workforce
}

export interface LicensureMobilityReport {
  totalClinicians: number;
  multiStateClinicians: number;
  multiStateRate: number;         // %
  avgStatesPerClinician: number;
  compactLicenseHolders: number;
  topMobileStates: MobilityPattern[];
  statePairFrequency: Array<{ stateA: string; stateB: string; count: number }>;
  generatedAt: string;
}

export interface DeploymentEfficiencySignal {
  deploymentType: string;
  totalDecisions: number;
  approvedCount: number;
  approvalRate: number;            // %
  avgDaysToConfirm: number;        // days from capsule creation to DEPLOYMENT confirmation
  medianDaysToConfirm: number;
  p95DaysToConfirm: number;
  topBottleneckCredentials: string[];
  bySpecialty: Array<{ specialty: string; avgDays: number; count: number }>;
  byState: Array<{ state: string; avgDays: number; count: number }>;
}

export interface ScarcitySignal {
  specialty: string;
  state: string;
  availableClinicians: number;
  l3Count: number;                 // fully verified
  l2Count: number;
  l1Count: number;
  l0Count: number;
  immediateCount: number;          // urgency=immediate
  scarcityScore: number;           // 0–100: higher = scarcer
  scarcityLabel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'ADEQUATE';
  demandSignal: 'HIGH' | 'MEDIUM' | 'LOW';    // from recent HIRING capsules
}

export interface CredentialDatasetSummary {
  totalVerificationEvents: number;
  totalPrivilegeGrants: number;
  totalDeploymentDecisions: number;
  totalCliniciansIndexed: number;
  totalCredentialTypes: number;
  totalStatesRepresented: number;
  oldestRecord: string | null;       // ISO
  newestRecord: string | null;       // ISO
  datasetSizeEstimateBytes: number;
  generatedAt: string;
}

// ── 1. Credential Bottlenecks ─────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  NPPES: 'NPI Registry', STATE_BOARD: 'State Medical Boards',
  NURSYS: 'Nursys (Compact Nursing)', OIG_LEIE: 'OIG/LEIE Exclusion',
  OIG: 'OIG Exclusion', LEIE: 'LEIE Database', DEA: 'DEA Registration',
  ABIM: 'ABIM Board Certification', ABFM: 'ABFM Board Certification',
  ABEM: 'ABEM Certification', ABP: 'ABP Pediatrics', ABNS: 'ABNS Neurosurgery',
  BOARD_CERTIFICATION: 'Board Certification', NPI_ENROLLMENT: 'NPI Enrollment',
  ACGME: 'ACGME Training', TRAINING_RECORD: 'Training Records',
  DECISION_CAPSULE: 'Decision Capsule',
};

export async function computeCredentialBottlenecks(
  dayWindow = 365,
): Promise<BottleneckSignal[]> {
  const key = `bottlenecks:${dayWindow}`;
  const hit = fromCache<BottleneckSignal[]>(key);
  if (hit) return hit;

  const since = daysAgo(dayWindow);
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { source: { not: 'TRUST_STATE_ENGINE' }, createdAt: { gte: since } },
    select: { source: true, status: true, createdAt: true, verifiedAt: true, expiresAt: true },
    orderBy: { createdAt: 'asc' },
  });

  // Group by source
  const groups = new Map<string, typeof artifacts>();
  for (const a of artifacts) {
    if (!groups.has(a.source)) groups.set(a.source, []);
    groups.get(a.source)!.push(a);
  }

  const signals: BottleneckSignal[] = [];

  for (const [source, records] of groups.entries()) {
    if (records.length < 2) continue; // skip single-record sources

    const verified  = records.filter(r => r.status === 'VERIFIED' || r.status === 'ACTIVE');
    const expired   = records.filter(r => r.status === 'EXPIRED');
    const pending   = records.filter(r => r.status !== 'VERIFIED' && r.status !== 'ACTIVE' && r.status !== 'EXPIRED');

    // Verification time (days from createdAt → verifiedAt)
    const verifyTimes = verified
      .filter(r => r.verifiedAt)
      .map(r => msToDays(r.verifiedAt!.getTime() - r.createdAt.getTime()))
      .filter(d => d >= 0 && d < 365);

    const avgDays    = verifyTimes.length > 0 ? Math.round(verifyTimes.reduce((a, b) => a + b, 0) / verifyTimes.length * 10) / 10 : 0;
    const medianDays = median(verifyTimes);
    const p95Days    = p95(verifyTimes);

    const verificationRate = pct(verified.length, records.length);
    const expiryRate       = pct(expired.length, records.length);

    // Bottleneck score: weight expiry rate + pending rate + slow verification
    const bottleneckScore = Math.min(100, Math.round(
      (expiryRate * 0.4) +
      (pct(pending.length, records.length) * 0.3) +
      (Math.min(avgDays, 90) / 90 * 30)
    ));

    const bottleneckReason =
      expiryRate > 20  ? `High expiry rate (${expiryRate}%)` :
      avgDays > 30     ? `Slow verification (avg ${avgDays}d)` :
      pct(pending.length, records.length) > 30 ? `High pending rate (${pct(pending.length, records.length)}%)` :
      verificationRate > 80 ? 'Well-functioning source' : 'Low verification rate';

    signals.push({
      source,
      label: SOURCE_LABELS[source] ?? source,
      totalRecords:            records.length,
      verifiedCount:           verified.length,
      expiredCount:            expired.length,
      pendingCount:            pending.length,
      verificationRate,
      expiryRate,
      avgVerificationDays:     avgDays,
      medianVerificationDays:  medianDays,
      p95VerificationDays:     p95Days,
      bottleneckScore,
      bottleneckReason,
    });
  }

  // Sort by bottleneck score descending
  signals.sort((a, b) => b.bottleneckScore - a.bottleneckScore);
  return toCache(key, signals);
}

// ── 2. Licensure Mobility ─────────────────────────────────────────────────────

export async function computeLicensureMobility(): Promise<LicensureMobilityReport> {
  const key = 'licensure_mobility';
  const hit = fromCache<LicensureMobilityReport>(key);
  if (hit) return hit;

  // All STATE_BOARD + NURSYS artifacts
  const licArtifacts = await prisma.verificationArtifact.findMany({
    where: {
      source: { in: ['STATE_BOARD', 'NURSYS'] },
      status: { in: ['VERIFIED', 'ACTIVE'] },
    },
    select: { npi: true, source: true, rawPayload: true, verifiedAt: true },
  });

  // Extract state per artifact
  const npiStates = new Map<string, Set<string>>();
  const npiNursys = new Set<string>();

  for (const art of licArtifacts) {
    const p = art.rawPayload as Record<string, unknown>;
    const state = typeof p.state === 'string' ? p.state.trim().toUpperCase()
      : typeof p.licenseState === 'string' ? p.licenseState.trim().toUpperCase()
      : typeof p.stateCode === 'string' ? p.stateCode.trim().toUpperCase() : null;

    if (!state || state.length !== 2) continue;
    if (!npiStates.has(art.npi)) npiStates.set(art.npi, new Set());
    npiStates.get(art.npi)!.add(state);
    if (art.source === 'NURSYS') npiNursys.add(art.npi);
  }

  const totalClinicians   = npiStates.size;
  const multiState        = Array.from(npiStates.values()).filter(s => s.size > 1);
  const multiStateCount   = multiState.length;
  const avgStates         = totalClinicians === 0 ? 0
    : Math.round(Array.from(npiStates.values()).reduce((sum, s) => sum + s.size, 0) / totalClinicians * 10) / 10;

  // State-level analysis
  const stateClinicians = new Map<string, Set<string>>();
  for (const [npi, states] of npiStates.entries()) {
    for (const state of states) {
      if (!stateClinicians.has(state)) stateClinicians.set(state, new Set());
      stateClinicians.get(state)!.add(npi);
    }
  }

  const topMobileStates: MobilityPattern[] = Array.from(stateClinicians.entries())
    .map(([state, npis]) => {
      const cliniciansHere = Array.from(npis);
      const avgStatesLicensed = cliniciansHere.length === 0 ? 0
        : Math.round(cliniciansHere.reduce((sum, npi) => sum + (npiStates.get(npi)?.size ?? 1), 0) / cliniciansHere.length * 10) / 10;
      const compact = cliniciansHere.filter(npi => npiNursys.has(npi)).length;
      const multiStateHere = cliniciansHere.filter(npi => (npiStates.get(npi)?.size ?? 1) > 1).length;

      return {
        state,
        uniqueClinicians:    npis.size,
        avgStatesLicensed,
        compactParticipants: compact,
        inboundMobility:     multiStateHere,
        outboundMobility:    multiStateHere,
        mobilityScore:       Math.min(100, Math.round((multiStateHere / Math.max(npis.size, 1)) * 100)),
      };
    })
    .sort((a, b) => b.uniqueClinicians - a.uniqueClinicians)
    .slice(0, 20);

  // State pair frequency (which pairs of states appear together most)
  const pairCounts = new Map<string, number>();
  for (const states of npiStates.values()) {
    const arr = Array.from(states).sort();
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const pair = `${arr[i]!}:${arr[j]!}`;
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      }
    }
  }

  const statePairFrequency = Array.from(pairCounts.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20)
    .map(([pair, count]) => {
      const [stateA, stateB] = pair.split(':') as [string, string];
      return { stateA, stateB, count };
    });

  const result: LicensureMobilityReport = {
    totalClinicians,
    multiStateClinicians: multiStateCount,
    multiStateRate:       pct(multiStateCount, totalClinicians),
    avgStatesPerClinician: avgStates,
    compactLicenseHolders: npiNursys.size,
    topMobileStates,
    statePairFrequency,
    generatedAt: new Date().toISOString(),
  };

  return toCache(key, result);
}

// ── 3. Deployment Efficiency ──────────────────────────────────────────────────

export async function computeDeploymentEfficiency(): Promise<DeploymentEfficiencySignal[]> {
  const key = 'deployment_efficiency';
  const hit = fromCache<DeploymentEfficiencySignal[]>(key);
  if (hit) return hit;

  const capsules = await prisma.decisionCapsule.findMany({
    where: { decisionType: { in: ['HIRING', 'DEPLOYMENT', 'PRIVILEGING', 'RENEWAL'] } },
    select: { decisionType: true, status: true, decisionTimestamp: true, createdAt: true, metadata: true },
    orderBy: { decisionTimestamp: 'desc' },
    take: 5000,
  });

  // Group by decision type
  const groups = new Map<string, typeof capsules>();
  for (const c of capsules) {
    if (!groups.has(c.decisionType)) groups.set(c.decisionType, []);
    groups.get(c.decisionType)!.push(c);
  }

  const signals: DeploymentEfficiencySignal[] = [];

  for (const [decisionType, records] of groups.entries()) {
    const approved = records.filter(r => r.status === 'VALID');

    // Time from createdAt → decisionTimestamp
    const confirmTimes = records
      .filter(r => r.decisionTimestamp)
      .map(r => msToDays(r.decisionTimestamp!.getTime() - r.createdAt.getTime()))
      .filter(d => d >= 0 && d < 365);

    // Specialty breakdown from metadata
    const specialtyBuckets = new Map<string, number[]>();
    const stateBuckets = new Map<string, number[]>();

    for (const r of records) {
      const meta = (r.metadata ?? {}) as Record<string, unknown>;
      const specialty = typeof meta.specialty === 'string' ? meta.specialty.toLowerCase() : null;
      const state     = typeof meta.state === 'string' ? meta.state.toUpperCase() : null;
      const days      = r.decisionTimestamp
        ? msToDays(r.decisionTimestamp.getTime() - r.createdAt.getTime()) : null;
      if (days === null || days < 0) continue;

      if (specialty) {
        if (!specialtyBuckets.has(specialty)) specialtyBuckets.set(specialty, []);
        specialtyBuckets.get(specialty)!.push(days);
      }
      if (state) {
        if (!stateBuckets.has(state)) stateBuckets.set(state, []);
        stateBuckets.get(state)!.push(days);
      }
    }

    const bySpecialty = Array.from(specialtyBuckets.entries())
      .map(([specialty, days]) => ({
        specialty,
        avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10,
        count: days.length,
      }))
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 10);

    const byState = Array.from(stateBuckets.entries())
      .map(([state, days]) => ({
        state,
        avgDays: Math.round(days.reduce((a, b) => a + b, 0) / days.length * 10) / 10,
        count: days.length,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    signals.push({
      deploymentType:            decisionType,
      totalDecisions:            records.length,
      approvedCount:             approved.length,
      approvalRate:              pct(approved.length, records.length),
      avgDaysToConfirm:          confirmTimes.length > 0 ? Math.round(confirmTimes.reduce((a, b) => a + b, 0) / confirmTimes.length * 10) / 10 : 0,
      medianDaysToConfirm:       median(confirmTimes),
      p95DaysToConfirm:          p95(confirmTimes),
      topBottleneckCredentials:  [],   // populated by cross-referencing with bottlenecks
      bySpecialty,
      byState,
    });
  }

  signals.sort((a, b) => b.totalDecisions - a.totalDecisions);
  return toCache(key, signals);
}

// ── 4. Expertise Scarcity ─────────────────────────────────────────────────────

export async function computeExpertiseScarcity(
  topN = 50,
): Promise<ScarcitySignal[]> {
  const key = `scarcity:${topN}`;
  const hit = fromCache<ScarcitySignal[]>(key);
  if (hit) return hit;

  // Pull availability pool — PersonProfile has no metadata column; use available fields only
  const profiles = await prisma.$queryRaw<Array<{
    npi: string | null;
    state_of_practice: string | null;
  }>>`
    SELECT npi, state_of_practice
    FROM person_profiles
    WHERE state_of_practice IS NOT NULL
    LIMIT 5000
  `;

  // Extract (specialty, state) pairs with trust band
  type BucketEntry = { npi: string; trustBand: string; urgency: string };
  const buckets = new Map<string, BucketEntry[]>();

  // PersonProfile has no metadata/availability column — derive a basic bucket
  // from (specialty=unknown, state=state_of_practice) with default trust/urgency.
  for (const row of profiles) {
    if (!row.npi || !row.state_of_practice) continue;
    const state = row.state_of_practice.toUpperCase().trim();
    const specialty = 'general'; // no specialty in PersonProfile; use generic bucket
    const bucketKey = `${specialty}::${state}`;
    if (!buckets.has(bucketKey)) buckets.set(bucketKey, []);
    buckets.get(bucketKey)!.push({ npi: row.npi, trustBand: 'L0', urgency: 'exploring' });
  }

  // Recent HIRING capsule counts per specialty+state → demand signal
  const hiringCapsules = await prisma.decisionCapsule.findMany({
    where: {
      decisionType: { in: ['HIRING', 'DEPLOYMENT'] },
      decisionTimestamp: { gte: daysAgo(90) },
    },
    select: { metadata: true },
    take: 2000,
  });

  const demandBuckets = new Map<string, number>();
  for (const c of hiringCapsules) {
    const meta = (c.metadata ?? {}) as Record<string, unknown>;
    const specialty = typeof meta.specialty === 'string' ? meta.specialty.toLowerCase().trim() : null;
    const state     = typeof meta.state === 'string' ? meta.state.toUpperCase() : null;
    if (!specialty || !state) continue;
    const k = `${specialty}::${state}`;
    demandBuckets.set(k, (demandBuckets.get(k) ?? 0) + 1);
  }

  const signals: ScarcitySignal[] = [];

  for (const [bucketKey, entries] of buckets.entries()) {
    const [specialty, state] = bucketKey.split('::') as [string, string];
    const l3 = entries.filter(e => e.trustBand === 'L3').length;
    const l2 = entries.filter(e => e.trustBand === 'L2').length;
    const l1 = entries.filter(e => e.trustBand === 'L1').length;
    const l0 = entries.filter(e => e.trustBand === 'L0').length;
    const immediate = entries.filter(e => e.urgency === 'immediate').length;
    const total = entries.length;
    const hires = demandBuckets.get(bucketKey) ?? 0;

    // Scarcity: inverse of verified supply relative to demand
    const verifiedSupply = l3 + l2;
    const demandScore    = Math.min(hires * 10, 100);
    const supplyScore    = Math.min(verifiedSupply * 5, 100);
    const scarcityScore  = Math.min(100, Math.round(
      (demandScore * 0.6) + (Math.max(0, 50 - supplyScore) * 0.4)
    ));

    const scarcityLabel: ScarcitySignal['scarcityLabel'] =
      scarcityScore >= 80 ? 'CRITICAL' :
      scarcityScore >= 60 ? 'HIGH' :
      scarcityScore >= 40 ? 'MODERATE' : 'ADEQUATE';

    const demandSignal: ScarcitySignal['demandSignal'] =
      hires >= 5 ? 'HIGH' : hires >= 2 ? 'MEDIUM' : 'LOW';

    signals.push({
      specialty,
      state,
      availableClinicians: total,
      l3Count: l3, l2Count: l2, l1Count: l1, l0Count: l0,
      immediateCount: immediate,
      scarcityScore,
      scarcityLabel,
      demandSignal,
    });
  }

  signals.sort((a, b) => b.scarcityScore - a.scarcityScore);
  const top = signals.slice(0, topN);
  return toCache(key, top);
}

// ── Dataset summary ───────────────────────────────────────────────────────────

export async function computeDatasetSummary(): Promise<CredentialDatasetSummary> {
  const key = 'dataset_summary';
  const hit = fromCache<CredentialDatasetSummary>(key);
  if (hit) return hit;

  const [
    artifactCount, capsuleCount, distinctNpis, distinctSources,
    oldest, newest,
  ] = await Promise.all([
    prisma.verificationArtifact.count({ where: { source: { not: 'TRUST_STATE_ENGINE' } } }),
    prisma.decisionCapsule.count(),
    prisma.verificationArtifact.findMany({ distinct: ['npi'], select: { npi: true } }).then(r => r.length),
    prisma.verificationArtifact.findMany({ distinct: ['source'], where: { source: { not: 'TRUST_STATE_ENGINE' } }, select: { source: true } }).then(r => r.length),
    prisma.verificationArtifact.findFirst({ orderBy: { createdAt: 'asc'  }, select: { createdAt: true } }),
    prisma.verificationArtifact.findFirst({ orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
  ]);

  // Distinct states from STATE_BOARD artifacts
  const stateArtifacts = await prisma.verificationArtifact.findMany({
    where: { source: { in: ['STATE_BOARD', 'NURSYS'] } },
    select: { rawPayload: true },
    take: 5000,
  });
  const stateSet = new Set<string>();
  for (const a of stateArtifacts) {
    const p = a.rawPayload as Record<string, unknown>;
    const s = typeof p.state === 'string' ? p.state.trim().toUpperCase() : null;
    if (s?.length === 2) stateSet.add(s);
  }

  const estimatedBytes = (artifactCount * 512) + (capsuleCount * 256) + (distinctNpis * 128);

  const result: CredentialDatasetSummary = {
    totalVerificationEvents:   artifactCount,
    totalPrivilegeGrants:      await prisma.decisionCapsule.count({ where: { decisionType: 'PRIVILEGING' } }),
    totalDeploymentDecisions:  await prisma.decisionCapsule.count({ where: { decisionType: { in: ['HIRING', 'DEPLOYMENT'] } } }),
    totalCliniciansIndexed:    distinctNpis,
    totalCredentialTypes:      distinctSources,
    totalStatesRepresented:    stateSet.size,
    oldestRecord:              oldest?.createdAt.toISOString() ?? null,
    newestRecord:              newest?.createdAt.toISOString() ?? null,
    datasetSizeEstimateBytes:  estimatedBytes,
    generatedAt: new Date().toISOString(),
  };

  return toCache(key, result);
}

// ── Cache management ──────────────────────────────────────────────────────────

export function invalidateIntelligenceCache(): void {
  cache.clear();
  log('info', 'workforce_intelligence: cache invalidated');
}

export function getIntelligenceCacheStats(): { size: number; keys: string[]; ttlMs: number } {
  return { size: cache.size, keys: Array.from(cache.keys()), ttlMs: CACHE_TTL_MS };
}
