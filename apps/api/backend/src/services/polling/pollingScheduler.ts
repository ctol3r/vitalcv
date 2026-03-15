/**
 * pollingScheduler.ts — Autonomous Polling Engine
 *
 * Powers the continuous investigator loop by scheduling source polls
 * at appropriate cadences, diffing results, and emitting events.
 *
 * Cadences:
 *   DAILY    — NPPES, OIG/LEIE, SAM.gov (fast-moving exclusion/identity data)
 *   WEEKLY   — PECOS, State Boards, Nursys (enrollment/licensure changes)
 *   MONTHLY  — D&C, OpenAlex, PubMed, ClinicalTrials (slower-moving data)
 *   ANNUAL   — Open Payments (annual CMS release)
 *
 * Each poll cycle: fetch → diff → emit events → store snapshot.
 * Burst mode: batch processing for large releases (Open Payments, NPDB).
 */

import { log } from '../../obs/logger';
import prisma from '../../graphql/prisma_client';
import type { IngestionSources } from '../identity/identityIngestionPipeline';
import { ingestClinicianIdentity } from '../identity/identityIngestionPipeline';
import { emitIntelligenceEvent } from '../intelligence/intelligenceEngine';
import { storeFinding, type FindingCategory, type FindingSeverity } from '../investigators/framework';
import { ingestFinding } from '../storylines/storylineEngine';

// ── Types ──────────────────────────────────────────────────────────────────────

export type PollCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ANNUAL';
export type PollStatus = 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface SourcePollConfig {
  source:       IngestionSources;
  cadence:      PollCadence;
  enabled:      boolean;
  description:  string;
  burstCapable: boolean;      // Can handle large batch releases
  maxBatchSize: number;       // Max NPIs per poll cycle
  timeoutMs:    number;       // Per-source timeout
}

export interface DiffEvent {
  id:          string;
  source:      IngestionSources;
  npi:         string;
  eventType:   'ADDED' | 'CHANGED' | 'REMOVED' | 'REFRESHED';
  field?:      string;
  oldValue?:   string;
  newValue?:   string;
  timestamp:   string;
}

export interface PollCycleResult {
  id:          string;
  source:      IngestionSources;
  cadence:     PollCadence;
  startedAt:   string;
  completedAt: string;
  durationMs:  number;
  npisPolled:  number;
  eventsGenerated: number;
  errors:      number;
  diffs:       DiffEvent[];
  status:      PollStatus;
}

export interface PollSnapshot {
  source:      IngestionSources;
  npi:         string;
  dataHash:    string;        // SHA-256 of raw payload for diff detection
  capturedAt:  string;
}

// ── Source Configuration ───────────────────────────────────────────────────────

const SOURCE_POLL_CONFIGS: SourcePollConfig[] = [
  // DAILY — fast-moving exclusion and identity data
  { source: 'NPPES_API',       cadence: 'DAILY',   enabled: true,  description: 'NPI registry — identity, taxonomy, addresses',  burstCapable: false, maxBatchSize: 100, timeoutMs: 30_000 },
  { source: 'OIG_LEIE',        cadence: 'DAILY',   enabled: true,  description: 'Exclusion list — sanctions, debarments',         burstCapable: false, maxBatchSize: 100, timeoutMs: 30_000 },
  { source: 'SAM_GOV',         cadence: 'DAILY',   enabled: true,  description: 'Federal exclusions and entity registrations',    burstCapable: false, maxBatchSize: 100, timeoutMs: 30_000 },

  // WEEKLY — enrollment and licensure
  { source: 'PECOS_PUBLIC',    cadence: 'WEEKLY',   enabled: true,  description: 'Medicare enrollment status',                    burstCapable: false, maxBatchSize: 200, timeoutMs: 60_000 },
  { source: 'NURSYS',          cadence: 'WEEKLY',   enabled: true,  description: 'Nursing license verification',                  burstCapable: false, maxBatchSize: 200, timeoutMs: 60_000 },
  { source: 'STATE_BOARD',     cadence: 'WEEKLY',   enabled: true,  description: 'State medical board license status',            burstCapable: false, maxBatchSize: 200, timeoutMs: 60_000 },

  // MONTHLY — slower-moving professional data
  { source: 'DOCTORS_CLINICIANS', cadence: 'MONTHLY', enabled: true, description: 'CMS Doctors & Clinicians directory',           burstCapable: false, maxBatchSize: 500, timeoutMs: 120_000 },
  { source: 'OPENALEX',        cadence: 'MONTHLY',  enabled: true,  description: 'Academic publications and citations',           burstCapable: false, maxBatchSize: 500, timeoutMs: 120_000 },
  { source: 'PUBMED',          cadence: 'MONTHLY',  enabled: true,  description: 'PubMed publication records',                    burstCapable: false, maxBatchSize: 500, timeoutMs: 120_000 },
  { source: 'CLINICAL_TRIALS', cadence: 'MONTHLY',  enabled: true,  description: 'Clinical trial involvement',                   burstCapable: false, maxBatchSize: 500, timeoutMs: 120_000 },

  // ANNUAL — bulk data releases
  { source: 'OPEN_PAYMENTS',   cadence: 'ANNUAL',   enabled: true,  description: 'CMS Open Payments (annual release)',            burstCapable: true,  maxBatchSize: 5000, timeoutMs: 300_000 },
];

// ── Cadence Intervals ──────────────────────────────────────────────────────────

const CADENCE_MS: Record<PollCadence, number> = {
  DAILY:   24 * 60 * 60 * 1000,
  WEEKLY:  7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
  ANNUAL:  365 * 24 * 60 * 60 * 1000,
};

// ── In-Memory State ────────────────────────────────────────────────────────────

const snapshots = new Map<string, PollSnapshot>();  // key: `${source}:${npi}`
const recentCycles: PollCycleResult[] = [];
const MAX_CYCLES = 100;
let cycleCounter = 0;
let diffCounter = 0;

const lastPollTime = new Map<IngestionSources, number>();
const activePollLock = new Set<IngestionSources>();

function makeCycleId(): string {
  return `poll_${Date.now().toString(36)}_${(++cycleCounter).toString(36)}`;
}

function makeDiffId(): string {
  return `diff_${Date.now().toString(36)}_${(++diffCounter).toString(36)}`;
}

function snapshotKey(source: IngestionSources, npi: string): string {
  return `${source}:${npi}`;
}

// ── Diff Engine ────────────────────────────────────────────────────────────────

/**
 * Simple hash of a JSON payload for diff detection.
 * Uses a fast string hash — not cryptographic, but deterministic.
 */
function quickHash(data: unknown): string {
  const str = JSON.stringify(data);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString(36);
}

/**
 * Compare current artifact payload against stored snapshot.
 * Returns diff events if data changed.
 */
function diffAgainstSnapshot(
  source: IngestionSources,
  npi: string,
  currentPayload: unknown,
): DiffEvent[] {
  const key = snapshotKey(source, npi);
  const currentHash = quickHash(currentPayload);
  const previous = snapshots.get(key);
  const now = new Date().toISOString();

  if (!previous) {
    // First time seeing this NPI from this source
    snapshots.set(key, { source, npi, dataHash: currentHash, capturedAt: now });
    return [{
      id: makeDiffId(),
      source,
      npi,
      eventType: 'ADDED',
      timestamp: now,
    }];
  }

  if (previous.dataHash === currentHash) {
    // No change — just update timestamp
    previous.capturedAt = now;
    return [{
      id: makeDiffId(),
      source,
      npi,
      eventType: 'REFRESHED',
      timestamp: now,
    }];
  }

  // Data changed
  snapshots.set(key, { source, npi, dataHash: currentHash, capturedAt: now });
  return [{
    id: makeDiffId(),
    source,
    npi,
    eventType: 'CHANGED',
    timestamp: now,
  }];
}

// ── Poll Execution ─────────────────────────────────────────────────────────────

/**
 * Get NPIs that should be polled for a given source.
 * Uses VerificationArtifact to find monitored providers.
 */
async function getNpisForSource(source: IngestionSources, limit: number): Promise<string[]> {
  try {
    const artifacts = await prisma.verificationArtifact.findMany({
      where: { source },
      select: { npi: true },
      distinct: ['npi'],
      orderBy: { verifiedAt: 'asc' },  // Oldest first = most stale
      take: limit,
    });
    return artifacts.map(a => a.npi);
  } catch {
    // Fallback: get any known NPIs
    const fallback = await prisma.verificationArtifact.findMany({
      select: { npi: true },
      distinct: ['npi'],
      take: limit,
    });
    return fallback.map(a => a.npi);
  }
}

/**
 * Poll a single source for a batch of NPIs.
 */
async function pollSource(config: SourcePollConfig): Promise<PollCycleResult> {
  const cycleId = makeCycleId();
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  const allDiffs: DiffEvent[] = [];
  let errors = 0;

  if (activePollLock.has(config.source)) {
    log('warn', `[Poller] ${config.source} already running — skipping`);
    return {
      id: cycleId, source: config.source, cadence: config.cadence,
      startedAt, completedAt: new Date().toISOString(),
      durationMs: 0, npisPolled: 0, eventsGenerated: 0, errors: 0,
      diffs: [], status: 'IDLE',
    };
  }

  activePollLock.add(config.source);
  log('info', `[Poller] Starting ${config.source} poll (${config.cadence})...`);

  try {
    const npis = await getNpisForSource(config.source, config.maxBatchSize);

    for (const npi of npis) {
      try {
        // Run ingestion for this NPI + source
        const report = await Promise.race([
          ingestClinicianIdentity(npi, [config.source]),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), config.timeoutMs)
          ),
        ]);

        if (report) {
          // Diff against snapshot
          const latestArtifact = await prisma.verificationArtifact.findFirst({
            where: { npi, source: config.source },
            orderBy: { verifiedAt: 'desc' },
            select: { rawPayload: true },
          });

          const diffs = diffAgainstSnapshot(config.source, npi, latestArtifact?.rawPayload);
          allDiffs.push(...diffs);

          // Emit intelligence events for CHANGED diffs
          for (const diff of diffs) {
            if (diff.eventType === 'CHANGED' || diff.eventType === 'ADDED') {
              await emitIntelligenceEvent({
                type: 'INGESTION_COMPLETE',
                npi: diff.npi,
                loop: 1,
                payload: { source: config.source, diffType: diff.eventType },
              });
            }
          }
        }
      } catch (err) {
        errors++;
        log('warn', `[Poller] ${config.source}/${npi} failed: ${(err as Error)?.message}`);
      }
    }

    lastPollTime.set(config.source, Date.now());

    const result: PollCycleResult = {
      id: cycleId,
      source: config.source,
      cadence: config.cadence,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
      npisPolled: npis.length,
      eventsGenerated: allDiffs.filter(d => d.eventType !== 'REFRESHED').length,
      errors,
      diffs: allDiffs,
      status: errors === npis.length ? 'FAILED' : 'COMPLETED',
    };

    recentCycles.unshift(result);
    if (recentCycles.length > MAX_CYCLES) recentCycles.length = MAX_CYCLES;

    // Generate findings for significant changes
    const changedDiffs = allDiffs.filter(d => d.eventType === 'CHANGED');
    if (changedDiffs.length > 0) {
      generatePollFindings(config, changedDiffs);
    }

    log('info', `[Poller] ${config.source} complete: ${npis.length} polled, ${changedDiffs.length} changed, ${errors} errors, ${result.durationMs}ms`);
    return result;

  } finally {
    activePollLock.delete(config.source);
  }
}

// ── Burst Event Handling ───────────────────────────────────────────────────────

export interface BurstEventConfig {
  source:      IngestionSources;
  description: string;
  npis:        string[];         // All NPIs to process
  batchSize:   number;           // Process N at a time
  delayMs:     number;           // Delay between batches (rate limiting)
}

export interface BurstResult {
  source:         IngestionSources;
  totalNpis:      number;
  processedNpis:  number;
  changedCount:   number;
  addedCount:     number;
  errorCount:     number;
  durationMs:     number;
  findings:       number;
}

/**
 * Process a large batch release (e.g., Open Payments annual, NPDB quarterly).
 * Runs in configurable batches with delays to avoid overwhelming external APIs.
 */
export async function processBurstEvent(config: BurstEventConfig): Promise<BurstResult> {
  const startMs = Date.now();
  let processed = 0;
  let changed = 0;
  let added = 0;
  let errors = 0;
  let findingsCreated = 0;

  log('info', `[Poller:Burst] Starting ${config.source} burst: ${config.npis.length} NPIs in batches of ${config.batchSize}`);

  for (let i = 0; i < config.npis.length; i += config.batchSize) {
    const batch = config.npis.slice(i, i + config.batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(async (npi) => {
        const report = await ingestClinicianIdentity(npi, [config.source]);
        if (!report) return null;

        const latestArtifact = await prisma.verificationArtifact.findFirst({
          where: { npi, source: config.source },
          orderBy: { verifiedAt: 'desc' },
          select: { rawPayload: true },
        });

        return diffAgainstSnapshot(config.source, npi, latestArtifact?.rawPayload);
      })
    );

    for (const result of batchResults) {
      processed++;
      if (result.status === 'rejected') {
        errors++;
        continue;
      }
      if (!result.value) continue;
      for (const diff of result.value) {
        if (diff.eventType === 'CHANGED') changed++;
        if (diff.eventType === 'ADDED') added++;
      }
    }

    // Rate limiting delay between batches
    if (i + config.batchSize < config.npis.length && config.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, config.delayMs));
    }

    log('info', `[Poller:Burst] ${config.source}: ${processed}/${config.npis.length} processed`);
  }

  // Generate summary finding for burst
  if (changed > 0 || added > 0) {
    const severity: FindingSeverity = changed > 50 ? 'HIGH' : changed > 10 ? 'MEDIUM' : 'LOW';
    const finding = storeFinding({
      investigator: 'polling-burst',
      category: 'COMPLIANCE' as FindingCategory,
      severity,
      title: `${config.source} burst: ${changed} changed, ${added} new across ${processed} providers`,
      summary: `${config.description}. Processed ${processed} NPIs: ${changed} records changed, ${added} new records detected, ${errors} errors.`,
      explanation: `Burst event from ${config.source} processed ${processed} providers. This is a scheduled bulk data release. Review changed records for trust score impact.`,
      npis: config.npis.slice(0, 20), // Cap at 20 for the finding
      evidence: [{
        source: config.source,
        claim: `Burst processing: ${changed} changed, ${added} new`,
        confidence: 0.95,
        timestamp: new Date().toISOString(),
      }],
      actions: [{
        id: 'review-burst',
        label: `Review ${config.source} changes`,
        type: 'investigate',
        payload: { source: config.source, changed, added },
      }],
      relatedFindings: [],
      metadata: { burstSource: config.source, processed, changed, added, errors },
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    try { ingestFinding(finding); } catch { /* best-effort */ }
    findingsCreated++;
  }

  const result: BurstResult = {
    source: config.source,
    totalNpis: config.npis.length,
    processedNpis: processed,
    changedCount: changed,
    addedCount: added,
    errorCount: errors,
    durationMs: Date.now() - startMs,
    findings: findingsCreated,
  };

  log('info', `[Poller:Burst] ${config.source} complete: ${processed} processed, ${changed} changed, ${added} new, ${errors} errors, ${result.durationMs}ms`);
  return result;
}

// ── Finding Generation ─────────────────────────────────────────────────────────

function generatePollFindings(config: SourcePollConfig, changedDiffs: DiffEvent[]): void {
  const isDailySafety = config.cadence === 'DAILY' &&
    ['OIG_LEIE', 'SAM_GOV'].includes(config.source);

  const severity: FindingSeverity = isDailySafety ? 'HIGH' : 'MEDIUM';
  const category: FindingCategory = isDailySafety ? 'EXCLUSION' as FindingCategory : 'COMPLIANCE' as FindingCategory;

  const finding = storeFinding({
    investigator: 'polling-scheduler',
    category,
    severity,
    title: `${config.source}: ${changedDiffs.length} provider(s) changed`,
    summary: `Polling cycle detected ${changedDiffs.length} data change(s) from ${config.source}. NPIs affected: ${changedDiffs.map(d => d.npi).slice(0, 5).join(', ')}${changedDiffs.length > 5 ? ` (+${changedDiffs.length - 5} more)` : ''}.`,
    explanation: `Scheduled ${config.cadence.toLowerCase()} poll of ${config.source} found data differences. ${isDailySafety ? 'SAFETY SOURCE — review immediately.' : 'Standard data refresh — review at next cycle.'}`,
    npis: changedDiffs.map(d => d.npi).slice(0, 20),
    evidence: changedDiffs.slice(0, 10).map(d => ({
      source: config.source,
      claim: `${d.eventType} for NPI ${d.npi}`,
      confidence: 0.9,
      timestamp: d.timestamp,
    })),
    actions: [{
      id: 'review-changes',
      label: `Review ${config.source} changes`,
      type: 'investigate',
      payload: { source: config.source, npis: changedDiffs.map(d => d.npi) },
    }],
    relatedFindings: [],
    metadata: { pollSource: config.source, cadence: config.cadence, diffCount: changedDiffs.length },
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  try { ingestFinding(finding); } catch { /* best-effort storyline ingestion */ }
}

// ── Scheduler ──────────────────────────────────────────────────────────────────

const schedulerTimers = new Map<string, ReturnType<typeof setInterval>>();
let schedulerRunning = false;

/**
 * Initialize the polling scheduler.
 * Each source gets its own timer at its cadence interval.
 *
 * On startup, checks which sources are overdue and polls them immediately.
 */
export function initPollingScheduler(): void {
  if (schedulerRunning) return;
  schedulerRunning = true;

  for (const config of SOURCE_POLL_CONFIGS) {
    if (!config.enabled) continue;

    const intervalMs = CADENCE_MS[config.cadence];
    const timerId = `poll_${config.source}`;

    if (schedulerTimers.has(timerId)) continue;

    // Schedule recurring poll
    const timer = setInterval(async () => {
      try {
        await pollSource(config);
      } catch (err) {
        log('error', `[Poller] Scheduled poll ${config.source} failed: ${(err as Error)?.message}`);
      }
    }, intervalMs);

    schedulerTimers.set(timerId, timer);
    log('info', `[Poller] Scheduled ${config.source} every ${config.cadence} (${intervalMs / 3600000}h)`);
  }

  // Check for overdue polls on startup
  setTimeout(async () => {
    for (const config of SOURCE_POLL_CONFIGS) {
      if (!config.enabled) continue;
      const lastPoll = lastPollTime.get(config.source);
      const intervalMs = CADENCE_MS[config.cadence];

      if (!lastPoll || (Date.now() - lastPoll) > intervalMs) {
        log('info', `[Poller] ${config.source} is overdue — polling now`);
        try {
          await pollSource(config);
        } catch (err) {
          log('error', `[Poller] Overdue poll ${config.source} failed: ${(err as Error)?.message}`);
        }
      }
    }
  }, 5000); // 5s after startup
}

export function shutdownPollingScheduler(): void {
  for (const timer of schedulerTimers.values()) {
    clearInterval(timer);
  }
  schedulerTimers.clear();
  schedulerRunning = false;
  log('info', '[Poller] Scheduler stopped');
}

// ── Manual Controls ────────────────────────────────────────────────────────────

/**
 * Manually trigger a poll for a specific source.
 */
export async function triggerPoll(source: IngestionSources): Promise<PollCycleResult | null> {
  const config = SOURCE_POLL_CONFIGS.find(c => c.source === source);
  if (!config) return null;
  return pollSource(config);
}

/**
 * Manually trigger all polls.
 */
export async function triggerAllPolls(): Promise<PollCycleResult[]> {
  const results: PollCycleResult[] = [];
  for (const config of SOURCE_POLL_CONFIGS) {
    if (!config.enabled) continue;
    try {
      results.push(await pollSource(config));
    } catch (err) {
      log('error', `[Poller] Manual poll ${config.source} failed: ${(err as Error)?.message}`);
    }
  }
  return results;
}

// ── Query ──────────────────────────────────────────────────────────────────────

export function getPollingStatus(): {
  running: boolean;
  sources: {
    source: IngestionSources;
    cadence: PollCadence;
    enabled: boolean;
    lastPoll: string | null;
    nextPoll: string | null;
    isOverdue: boolean;
    isActive: boolean;
  }[];
  recentCycles: number;
  totalDiffs: number;
} {
  const sources = SOURCE_POLL_CONFIGS.map(config => {
    const last = lastPollTime.get(config.source);
    const intervalMs = CADENCE_MS[config.cadence];
    return {
      source: config.source,
      cadence: config.cadence,
      enabled: config.enabled,
      lastPoll: last ? new Date(last).toISOString() : null,
      nextPoll: last ? new Date(last + intervalMs).toISOString() : null,
      isOverdue: !last || (Date.now() - last) > intervalMs,
      isActive: activePollLock.has(config.source),
    };
  });

  return {
    running: schedulerRunning,
    sources,
    recentCycles: recentCycles.length,
    totalDiffs: recentCycles.reduce((s, c) => s + c.eventsGenerated, 0),
  };
}

export function getRecentPollCycles(limit = 20): PollCycleResult[] {
  return recentCycles.slice(0, limit);
}

export function getSourcePollConfigs(): SourcePollConfig[] {
  return [...SOURCE_POLL_CONFIGS];
}
