/**
 * intelligenceEngine.ts — VitalCV Intelligence Engine
 *
 * Orchestrates four learning loops across all VitalCV subsystems:
 *
 * Loop 1: SOURCE INGESTION → TRUST UPDATE
 *   ingest new data → recompute trust score → update graph → emit events
 *
 * Loop 2: ANOMALY DETECTION → ALERT FEEDBACK
 *   divergence scan → watchtower alert → resolution tracking → rule refinement
 *
 * Loop 3: AI SUGGESTIONS → DECISION LEARNING
 *   graph link suggestions → user accept/reject → confidence calibration → strategy tuning
 *
 * Loop 4: GRAPH INSIGHTS → QUERY OPTIMIZATION
 *   query patterns → insight generation → precompute hot paths → cache warming
 *
 * All loops are event-driven with in-memory event bus. No external dependencies.
 * Each loop can run independently or be triggered by the orchestrator.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { computeTrustScoreV1, type TrustScoreV1 } from '../trust/trustScoreV1';
import { computeTrustFreshness } from '../identity/freshnessModel';
import { detectDivergence, type DivergenceReport } from '../identity/divergenceEngine';
import { monitorClinicianIdentity } from '../identity/changeMonitor';
import { ingestClinicianIdentity, type IngestionSources } from '../identity/identityIngestionPipeline';

// ── Event system ───────────────────────────────────────────────────────────────

export type IntelligenceEventType =
  | 'INGESTION_COMPLETE'
  | 'TRUST_SCORE_UPDATED'
  | 'DIVERGENCE_DETECTED'
  | 'DIVERGENCE_RESOLVED'
  | 'ALERT_FIRED'
  | 'AI_SUGGESTION_ACCEPTED'
  | 'AI_SUGGESTION_REJECTED'
  | 'INSIGHT_GENERATED'
  | 'FRESHNESS_DECAY'
  | 'LOOP_CYCLE_COMPLETE';

export interface IntelligenceEvent {
  id:        string;
  type:      IntelligenceEventType;
  npi?:      string;
  timestamp: string;
  payload:   Record<string, unknown>;
  loop:      1 | 2 | 3 | 4;
}

type EventHandler = (event: IntelligenceEvent) => void | Promise<void>;

const handlers = new Map<IntelligenceEventType, EventHandler[]>();
const eventLog: IntelligenceEvent[] = [];
const MAX_EVENT_LOG = 5000;

let eventCounter = 0;

function makeEventId(): string {
  return `ie_${Date.now().toString(36)}_${(++eventCounter).toString(36)}`;
}

export function onIntelligenceEvent(type: IntelligenceEventType, handler: EventHandler): void {
  const list = handlers.get(type) ?? [];
  list.push(handler);
  handlers.set(type, list);
}

export async function emitIntelligenceEvent(event: Omit<IntelligenceEvent, 'id' | 'timestamp'>): Promise<void> {
  const full: IntelligenceEvent = {
    ...event,
    id:        makeEventId(),
    timestamp: new Date().toISOString(),
  };

  eventLog.push(full);
  if (eventLog.length > MAX_EVENT_LOG) eventLog.splice(0, eventLog.length - MAX_EVENT_LOG);

  const eventHandlers = handlers.get(full.type) ?? [];
  for (const handler of eventHandlers) {
    try {
      await handler(full);
    } catch (err) {
      log('warn', `[IntelligenceEngine] handler error for ${full.type}: ${(err as Error)?.message}`);
    }
  }
}

export function getRecentEvents(limit = 100): IntelligenceEvent[] {
  return eventLog.slice(-limit);
}

// ── Loop 1: Source Ingestion → Trust Update ─────────────────────────────────

export interface IngestionResult {
  npi:           string;
  sourcesRun:    string[];
  claimsFound:   number;
  trustScore:    TrustScoreV1 | null;
  divergence:    DivergenceReport | null;
  duration:      number;
}

/**
 * Full intelligence cycle for a single clinician:
 * Ingest → Score → Detect divergence → Update graph → Emit events
 */
export async function runIngestionLoop(
  npi: string,
  sources: string[] | 'ALL' = 'ALL',
): Promise<IngestionResult> {
  const startMs = Date.now();
  log('info', `[Loop1] Starting ingestion cycle for NPI ${npi}`);

  let sourcesRun: string[] = [];
  let claimsFound = 0;
  let trustScore: TrustScoreV1 | null = null;
  let divergence: DivergenceReport | null = null;

  try {
    // Step 1: Ingest
    const ingestionSources: IngestionSources[] = sources === 'ALL' ? ['ALL'] : sources as IngestionSources[];
    const ingestionReport = await ingestClinicianIdentity(npi, ingestionSources);
    sourcesRun = ingestionReport.results?.map(r => r.source) ?? [];
    claimsFound = ingestionReport.claimsTotal ?? 0;

    await emitIntelligenceEvent({
      type: 'INGESTION_COMPLETE', npi, loop: 1,
      payload: { sourcesRun, claimsFound },
    });

    // Step 2: Recompute trust score
    trustScore = await computeTrustScoreV1(npi);

    await emitIntelligenceEvent({
      type: 'TRUST_SCORE_UPDATED', npi, loop: 1,
      payload: { score: trustScore.score, band: trustScore.band, confidence: trustScore.confidence },
    });

    // Step 3: Run divergence detection
    divergence = await detectDivergence(npi);

    if (divergence.hasBlocking) {
      await emitIntelligenceEvent({
        type: 'DIVERGENCE_DETECTED', npi, loop: 1,
        payload: {
          conflicts: divergence.conflicts.length,
          critical: divergence.conflicts.filter(c => c.severity === 'CRITICAL').length,
          penalty: divergence.totalPenalty,
        },
      });
    }
  } catch (err) {
    log('error', `[Loop1] Ingestion cycle failed for NPI ${npi}: ${(err as Error)?.message}`);
  }

  const duration = Date.now() - startMs;

  await emitIntelligenceEvent({
    type: 'LOOP_CYCLE_COMPLETE', npi, loop: 1,
    payload: { duration, sourcesRun: sourcesRun.length, claimsFound, score: trustScore?.score ?? null },
  });

  return { npi, sourcesRun, claimsFound, trustScore, divergence, duration };
}

// ── Loop 2: Anomaly Detection → Alert Feedback ───────────────────────────────

export interface AnomalyReport {
  npi:              string;
  divergenceCount:  number;
  monitorAlerts:    number;
  freshnessAlerts:  number;
  overallHealth:    string;
  actionItems:      string[];
}

/**
 * Full anomaly detection cycle:
 * Divergence scan → freshness check → monitor health → emit alerts
 */
export async function runAnomalyLoop(npi: string): Promise<AnomalyReport> {
  log('info', `[Loop2] Anomaly detection for NPI ${npi}`);
  const actionItems: string[] = [];

  // Step 1: Divergence
  const divergence = await detectDivergence(npi);
  if (divergence.conflicts.length > 0) {
    for (const c of divergence.conflicts) {
      actionItems.push(`[${c.severity}] ${c.description}`);
      await emitIntelligenceEvent({
        type: c.severity === 'CRITICAL' ? 'ALERT_FIRED' : 'DIVERGENCE_DETECTED',
        npi, loop: 2,
        payload: { conflictId: c.id, severity: c.severity, description: c.description },
      });
    }
  }

  // Step 2: Freshness
  const freshness = await computeTrustFreshness(npi);
  const freshnessAlerts = freshness.monitoringAlerts.length;
  for (const alert of freshness.monitoringAlerts) {
    actionItems.push(`[FRESHNESS] ${alert.message}`);
    await emitIntelligenceEvent({
      type: 'FRESHNESS_DECAY', npi, loop: 2,
      payload: { claimClass: alert.claimClass, severity: alert.severity, ageHours: alert.ageHours },
    });
  }

  // Step 3: Monitor health
  let overallHealth = 'HEALTHY';
  try {
    const monitor = await monitorClinicianIdentity(npi);
    overallHealth = monitor.overallHealth;
    for (const alert of monitor.alerts ?? []) {
      actionItems.push(`[MONITOR] ${alert.message ?? alert.type}`);
    }
  } catch {
    overallHealth = 'UNKNOWN';
  }

  await emitIntelligenceEvent({
    type: 'LOOP_CYCLE_COMPLETE', npi, loop: 2,
    payload: { divergenceCount: divergence.conflicts.length, freshnessAlerts, overallHealth },
  });

  return {
    npi,
    divergenceCount: divergence.conflicts.length,
    monitorAlerts: actionItems.filter(a => a.startsWith('[MONITOR]')).length,
    freshnessAlerts,
    overallHealth,
    actionItems,
  };
}

// ── Loop 3: AI Suggestions → Decision Learning ──────────────────────────────

/**
 * Decision learning state — tracks acceptance/rejection patterns
 * to calibrate future AI link suggestion confidence.
 */
interface DecisionLearningState {
  totalSuggestions:  number;
  accepted:         number;
  rejected:         number;
  acceptanceRate:   number;
  byStrategy:       Record<string, { accepted: number; rejected: number; rate: number }>;
  lastUpdated:      string;
}

const decisionState: DecisionLearningState = {
  totalSuggestions: 0, accepted: 0, rejected: 0, acceptanceRate: 0,
  byStrategy: {}, lastUpdated: new Date().toISOString(),
};

export function recordAiDecision(
  suggestionId: string,
  action: 'accept' | 'reject',
  strategy?: string,
): void {
  decisionState.totalSuggestions++;
  if (action === 'accept') decisionState.accepted++;
  else decisionState.rejected++;
  decisionState.acceptanceRate =
    decisionState.totalSuggestions > 0
      ? decisionState.accepted / decisionState.totalSuggestions
      : 0;

  if (strategy) {
    const s = decisionState.byStrategy[strategy] ?? { accepted: 0, rejected: 0, rate: 0 };
    if (action === 'accept') s.accepted++;
    else s.rejected++;
    s.rate = (s.accepted + s.rejected) > 0 ? s.accepted / (s.accepted + s.rejected) : 0;
    decisionState.byStrategy[strategy] = s;
  }

  decisionState.lastUpdated = new Date().toISOString();

  emitIntelligenceEvent({
    type: action === 'accept' ? 'AI_SUGGESTION_ACCEPTED' : 'AI_SUGGESTION_REJECTED',
    loop: 3,
    payload: { suggestionId, strategy, globalAcceptanceRate: decisionState.acceptanceRate },
  });
}

export function getDecisionLearningState(): DecisionLearningState {
  return { ...decisionState };
}

/**
 * Confidence calibration: adjust future suggestion threshold
 * based on observed acceptance rate per strategy.
 *
 * Returns: suggested minConfidence for auto-apply per strategy.
 */
export function calibrateConfidenceThresholds(): Record<string, number> {
  const thresholds: Record<string, number> = {};
  for (const [strategy, stats] of Object.entries(decisionState.byStrategy)) {
    const total = stats.accepted + stats.rejected;
    if (total < 10) {
      thresholds[strategy] = 0.85; // Default conservative
      continue;
    }
    // High acceptance → lower threshold; low acceptance → raise threshold
    if (stats.rate > 0.8) thresholds[strategy] = 0.70;
    else if (stats.rate > 0.6) thresholds[strategy] = 0.80;
    else if (stats.rate > 0.4) thresholds[strategy] = 0.90;
    else thresholds[strategy] = 0.95; // Almost all rejected → very conservative
  }
  return thresholds;
}

// ── Loop 4: Graph Insights → Query Optimization ─────────────────────────────

export type InsightType =
  | 'DECLINING_TRUST'
  | 'HIGH_INFLUENCE_INVESTIGATOR'
  | 'RARE_SPECIALTY_INSTITUTION'
  | 'RESEARCH_CLUSTER'
  | 'STALE_COVERAGE_GAP'
  | 'DIVERGENCE_HOTSPOT'
  | 'TRUST_IMPROVEMENT'
  | 'NEW_EXCLUSION_RISK'
  | 'FRESHNESS_LEADER'
  | 'CROSS_STATE_MOBILITY';

export interface Insight {
  id:          string;
  type:        InsightType;
  title:       string;
  description: string;
  priority:    'HIGH' | 'MEDIUM' | 'LOW';
  npis?:       string[];
  metadata:    Record<string, unknown>;
  generatedAt: string;
  actionable:  boolean;
  action?:     string;
}

const insightCache: Insight[] = [];
let insightCounter = 0;

function makeInsightId(): string {
  return `ins_${Date.now().toString(36)}_${(++insightCounter).toString(36)}`;
}

/**
 * Generate insights by scanning across clinician data.
 * Runs as part of Loop 4 — typically on a schedule (every 6–24h).
 */
export async function generateInsights(options?: {
  limit?: number;
  types?: InsightType[];
}): Promise<Insight[]> {
  const limit = options?.limit ?? 20;
  const insights: Insight[] = [];

  try {
    // ── Insight: Declining Trust Scores ──────────────────────────────────
    // Find clinicians whose trust state degraded recently
    const recentArtifacts = await prisma.verificationArtifact.findMany({
      where: {
        source: 'TRUST_STATE_ENGINE',
        verifiedAt: { gte: new Date(Date.now() - 7 * 24 * 3_600_000) },
      },
      orderBy: { verifiedAt: 'desc' },
      take: 500,
      select: { npi: true, rawPayload: true, verifiedAt: true },
    });

    // Group by NPI, find those with multiple entries (score changes)
    const byNpi = new Map<string, Array<{ score: number; band: string; at: Date }>>();
    for (const art of recentArtifacts) {
      const payload = typeof art.rawPayload === 'string'
        ? JSON.parse(art.rawPayload)
        : art.rawPayload;
      const snap = (payload as Record<string, unknown>)?.trust_state_snapshot ?? payload;
      const score = typeof (snap as Record<string, unknown>)?.readiness_score === 'number'
        ? (snap as Record<string, unknown>).readiness_score as number : null;
      const band = typeof (snap as Record<string, unknown>)?.trustBand === 'string'
        ? (snap as Record<string, unknown>).trustBand as string : null;

      if (score !== null && band !== null) {
        const list = byNpi.get(art.npi) ?? [];
        list.push({ score, band, at: art.verifiedAt });
        byNpi.set(art.npi, list);
      }
    }

    for (const [npi, entries] of byNpi) {
      if (entries.length < 2) continue;
      entries.sort((a, b) => b.at.getTime() - a.at.getTime());
      const newest = entries[0]!;
      const older = entries[entries.length - 1]!;
      const delta = newest.score - older.score;

      if (delta <= -10) {
        insights.push({
          id: makeInsightId(), type: 'DECLINING_TRUST',
          title: `Trust score declined for NPI ${npi}`,
          description: `Score dropped ${Math.abs(delta)} pts (${older.score}→${newest.score}) over ${Math.round((newest.at.getTime() - older.at.getTime()) / 86_400_000)}d. Band: ${newest.band}.`,
          priority: delta <= -20 ? 'HIGH' : 'MEDIUM',
          npis: [npi],
          metadata: { oldScore: older.score, newScore: newest.score, delta, band: newest.band },
          generatedAt: new Date().toISOString(),
          actionable: true,
          action: `Run POST /api/trust/score/${npi} to investigate dimensions. Check freshness and divergence.`,
        });
      }

      if (delta >= 15) {
        insights.push({
          id: makeInsightId(), type: 'TRUST_IMPROVEMENT',
          title: `Trust score improved for NPI ${npi}`,
          description: `Score improved ${delta} pts (${older.score}→${newest.score}). Band: ${newest.band}.`,
          priority: 'LOW',
          npis: [npi],
          metadata: { oldScore: older.score, newScore: newest.score, delta, band: newest.band },
          generatedAt: new Date().toISOString(),
          actionable: false,
        });
      }
    }

    // ── Insight: Stale Coverage Gaps ─────────────────────────────────────
    // Find profiles that haven't been re-verified recently
    const staleProfiles = await prisma.verificationArtifact.groupBy({
      by: ['npi'],
      _max: { verifiedAt: true },
      where: {
        status: { not: 'REVOKED' },
      },
      having: {
        verifiedAt: {
          _max: { lt: new Date(Date.now() - 30 * 24 * 3_600_000) },
        },
      },
      orderBy: { _max: { verifiedAt: 'asc' } },
      take: 50,
    });

    if (staleProfiles.length > 0) {
      const staleNpis = staleProfiles.map((p: { npi: string }) => p.npi);
      insights.push({
        id: makeInsightId(), type: 'STALE_COVERAGE_GAP',
        title: `${staleProfiles.length} clinician(s) have stale verification data`,
        description: `These NPIs have not been re-verified in 30+ days. Trust scores may not reflect current status.`,
        priority: staleProfiles.length > 20 ? 'HIGH' : 'MEDIUM',
        npis: staleNpis.slice(0, 10),
        metadata: { totalStale: staleProfiles.length },
        generatedAt: new Date().toISOString(),
        actionable: true,
        action: `Run batch ingestion for stale NPIs: POST /api/identity/:npi/ingest for each.`,
      });
    }

    // ── Insight: Research clusters ────────────────────────────────────────
    // Clinicians with clinical trial + publication claims = research-active
    const researchArts = await prisma.verificationArtifact.findMany({
      where: {
        source: { in: ['OPENALEX', 'PUBMED', 'CLINICAL_TRIALS'] },
        status: { not: 'REVOKED' },
      },
      select: { npi: true, source: true },
      take: 1000,
    });

    const researchNpis = new Map<string, Set<string>>();
    for (const art of researchArts) {
      const sources = researchNpis.get(art.npi) ?? new Set();
      sources.add(art.source);
      researchNpis.set(art.npi, sources);
    }

    const multiSourceResearchers = [...researchNpis.entries()]
      .filter(([_, sources]) => sources.size >= 2)
      .map(([npi]) => npi);

    if (multiSourceResearchers.length > 0) {
      insights.push({
        id: makeInsightId(), type: 'RESEARCH_CLUSTER',
        title: `${multiSourceResearchers.length} research-active clinician(s) identified`,
        description: `These clinicians have verified publications AND clinical trial records from multiple academic databases.`,
        priority: 'MEDIUM',
        npis: multiSourceResearchers.slice(0, 10),
        metadata: { totalResearchers: multiSourceResearchers.length },
        generatedAt: new Date().toISOString(),
        actionable: false,
      });
    }

  } catch (err) {
    log('error', `[Loop4] Insight generation failed: ${(err as Error)?.message}`);
  }

  // Sort by priority
  const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  insights.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  const result = insights.slice(0, limit);

  // Cache
  insightCache.splice(0, insightCache.length, ...result);

  for (const insight of result) {
    await emitIntelligenceEvent({
      type: 'INSIGHT_GENERATED', loop: 4,
      payload: { insightId: insight.id, type: insight.type, priority: insight.priority },
    });
  }

  log('info', `[Loop4] Generated ${result.length} insights`);
  return result;
}

export function getCachedInsights(): Insight[] {
  return [...insightCache];
}

// ── Orchestrator ───────────────────────────────────────────────────────────────

export interface OrchestratorStatus {
  running:       boolean;
  lastCycle:     string | null;
  totalCycles:   number;
  totalEvents:   number;
  loopStatus:    Record<1 | 2 | 3 | 4, { lastRun: string | null; errors: number }>;
  decisionState: DecisionLearningState;
  insightCount:  number;
}

const orchestratorState = {
  running:     false,
  lastCycle:   null as string | null,
  totalCycles: 0,
  loopStatus: {
    1: { lastRun: null as string | null, errors: 0 },
    2: { lastRun: null as string | null, errors: 0 },
    3: { lastRun: null as string | null, errors: 0 },
    4: { lastRun: null as string | null, errors: 0 },
  },
};

/**
 * Run a full orchestration cycle across all loops for a set of NPIs.
 * Called on a schedule (e.g., every 6 hours via cron or MONITORING_ENABLED).
 */
export async function runOrchestrationCycle(options?: {
  npis?: string[];
  maxIngestions?: number;
  skipInsights?: boolean;
}): Promise<{
  npis:        number;
  ingestions:  number;
  anomalies:   number;
  insights:    number;
  duration:    number;
}> {
  orchestratorState.running = true;
  const startMs = Date.now();
  let ingestionCount = 0;
  let anomalyCount = 0;
  let insightCount = 0;
  let npis: string[] = [];

  try {
    // Determine NPIs to process
    npis = options?.npis ?? [];
    if (npis.length === 0) {
      // Default: grab tracked clinicians with stale data
      const tracked = await prisma.verificationArtifact.groupBy({
        by: ['npi'],
        _max: { verifiedAt: true },
        having: {
          verifiedAt: {
            _max: { lt: new Date(Date.now() - 24 * 3_600_000) },
          },
        },
        orderBy: { _max: { verifiedAt: 'asc' } },
        take: options?.maxIngestions ?? 25,
      });
      npis = tracked.map((t: { npi: string }) => t.npi);
    }

    // Loop 1: Ingestion for stale NPIs
    for (const npi of npis.slice(0, options?.maxIngestions ?? 25)) {
      try {
        await runIngestionLoop(npi);
        ingestionCount++;
        orchestratorState.loopStatus[1].lastRun = new Date().toISOString();
      } catch {
        orchestratorState.loopStatus[1].errors++;
      }
    }

    // Loop 2: Anomaly detection for all
    for (const npi of npis) {
      try {
        const report = await runAnomalyLoop(npi);
        anomalyCount += report.divergenceCount + report.freshnessAlerts;
        orchestratorState.loopStatus[2].lastRun = new Date().toISOString();
      } catch {
        orchestratorState.loopStatus[2].errors++;
      }
    }

    // Loop 3: Decision learning state is updated reactively (on accept/reject events)
    orchestratorState.loopStatus[3].lastRun = new Date().toISOString();

    // Loop 4: Insight generation
    if (!options?.skipInsights) {
      try {
        const insights = await generateInsights({ limit: 20 });
        insightCount = insights.length;
        orchestratorState.loopStatus[4].lastRun = new Date().toISOString();
      } catch {
        orchestratorState.loopStatus[4].errors++;
      }
    }
  } finally {
    orchestratorState.running = false;
    orchestratorState.lastCycle = new Date().toISOString();
    orchestratorState.totalCycles++;
  }

  const duration = Date.now() - startMs;
  log('info', `[Orchestrator] Cycle complete: ${ingestionCount} ingestions, ${anomalyCount} anomalies, ${insightCount} insights in ${duration}ms`);

  return { npis: npis.length, ingestions: ingestionCount, anomalies: anomalyCount, insights: insightCount, duration };
}

export function getOrchestratorStatus(): OrchestratorStatus {
  return {
    ...orchestratorState,
    totalEvents: eventLog.length,
    decisionState: getDecisionLearningState(),
    insightCount: insightCache.length,
  };
}
