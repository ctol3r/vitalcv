/**
 * framework.ts — Autonomous Investigator Framework
 *
 * Investigators are continuous intelligence agents that watch provider data
 * and surface explainable findings. They are NOT notifications — they are
 * a native intelligence layer woven into every surface.
 *
 * Architecture:
 *   Event Bus → Investigator.evaluate() → Finding → FeedStore → Surfaces
 *                                                      ↑
 *                              User feedback ──────────┘
 *
 * Each investigator:
 *   1. Subscribes to specific IntelligenceEvent types
 *   2. Evaluates whether a finding is warranted
 *   3. Produces a Finding with severity, evidence chain, and actions
 *   4. Findings are ranked by the FeedStore and delivered to surfaces
 *
 * Isolation: investigators cannot crash each other. Each runs in its own
 * try/catch with timeout. A failing investigator is logged and skipped.
 */

import { log } from '../../obs/logger';
import type { IntelligenceEventType, IntelligenceEvent } from '../intelligence/intelligenceEngine';

// ── Finding Types ──────────────────────────────────────────────────────────────

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type FindingCategory =
  | 'TRUST_DECLINE'
  | 'DIVERGENCE'
  | 'RESEARCH_MOMENTUM'
  | 'NETWORK_EMERGENCE'
  | 'WORKFORCE_PRESSURE'
  | 'INDUSTRY_INFLUENCE'
  | 'FRESHNESS'
  | 'EXCLUSION'
  | 'COMPLIANCE';

export interface FindingEvidence {
  source:      string;          // e.g. 'TrustScoreV1', 'NPPES_API', 'OIG_LEIE'
  claim:       string;          // What the evidence says
  confidence:  number;          // 0–1
  artifactId?: string;          // Link to VerificationArtifact
  timestamp:   string;
}

export interface FindingAction {
  id:          string;
  label:       string;          // "Re-verify licensure"
  type:        'investigate' | 'verify' | 'monitor' | 'compare' | 'dismiss' | 'escalate';
  payload:     Record<string, unknown>;  // Data needed to execute
}

export interface Finding {
  id:            string;
  investigator:  string;        // Investigator ID that produced this
  category:      FindingCategory;
  severity:      FindingSeverity;
  title:         string;
  summary:       string;        // 1–2 sentence explanation
  explanation:   string;        // Full reasoning chain
  npis:          string[];
  evidence:      FindingEvidence[];
  actions:       FindingAction[];
  relatedFindings: string[];    // IDs of related findings
  metadata:      Record<string, unknown>;
  createdAt:     string;
  expiresAt:     string | null; // Auto-dismiss after this time
  status:        'ACTIVE' | 'ACKNOWLEDGED' | 'DISMISSED' | 'ESCALATED' | 'EXPIRED';
  score:         number;        // Ranking score (0–100), computed by FeedStore
  feedbackCount: number;
}

// ── Investigator Interface ─────────────────────────────────────────────────────

export interface InvestigatorConfig {
  id:             string;
  name:           string;
  description:    string;
  category:       FindingCategory;
  triggers:       IntelligenceEventType[];
  /** How often to run proactive scans (ms). 0 = event-driven only. */
  scanIntervalMs: number;
  /** Max findings per scan to prevent flooding */
  maxFindingsPerScan: number;
  /** Whether this investigator is enabled */
  enabled:        boolean;
}

export interface InvestigatorResult {
  findings:    Omit<Finding, 'id' | 'createdAt' | 'status' | 'score' | 'feedbackCount'>[];
  scannedNpis: number;
  durationMs:  number;
}

export interface Investigator {
  config:    InvestigatorConfig;
  /** Evaluate a specific event (reactive) */
  evaluate:  (event: IntelligenceEvent) => Promise<InvestigatorResult>;
  /** Proactive scan — run on schedule */
  scan:      () => Promise<InvestigatorResult>;
}

// ── Feed Store ─────────────────────────────────────────────────────────────────
//
// In-memory finding store. Findings are ranked by a composite score
// based on severity, recency, user feedback, and evidence quality.
//

const findings: Finding[] = [];
const MAX_FINDINGS = 500;
let findingCounter = 0;

function makeFindingId(): string {
  return `fnd_${Date.now().toString(36)}_${(++findingCounter).toString(36)}`;
}

const SEVERITY_WEIGHT: Record<FindingSeverity, number> = {
  CRITICAL: 100,
  HIGH:     75,
  MEDIUM:   50,
  LOW:      25,
  INFO:     10,
};

function computeFindingScore(f: Omit<Finding, 'id' | 'createdAt' | 'status' | 'score' | 'feedbackCount'>): number {
  const severityBase = SEVERITY_WEIGHT[f.severity];
  const evidenceBonus = Math.min(f.evidence.length * 5, 20);
  const avgConfidence = f.evidence.length > 0
    ? f.evidence.reduce((sum, e) => sum + e.confidence, 0) / f.evidence.length
    : 0.5;
  const confidenceBonus = avgConfidence * 15;
  const actionBonus = f.actions.length > 0 ? 5 : 0;

  return Math.min(Math.round(severityBase + evidenceBonus + confidenceBonus + actionBonus), 100);
}

export function storeFinding(
  raw: Omit<Finding, 'id' | 'createdAt' | 'status' | 'score' | 'feedbackCount'>,
): Finding {
  // Deduplicate: same investigator + same NPIs + same category within 1 hour
  const dupeWindow = 60 * 60 * 1000;
  const now = Date.now();
  const npiKey = raw.npis.sort().join(',');
  const isDupe = findings.some(f =>
    f.investigator === raw.investigator &&
    f.category === raw.category &&
    f.npis.sort().join(',') === npiKey &&
    f.status === 'ACTIVE' &&
    now - new Date(f.createdAt).getTime() < dupeWindow,
  );

  if (isDupe) {
    log('debug', `[FeedStore] Suppressed duplicate finding from ${raw.investigator} for ${npiKey}`);
    // Return the existing finding
    return findings.find(f =>
      f.investigator === raw.investigator &&
      f.category === raw.category &&
      f.npis.sort().join(',') === npiKey &&
      f.status === 'ACTIVE',
    )!;
  }

  const finding: Finding = {
    ...raw,
    id: makeFindingId(),
    createdAt: new Date().toISOString(),
    status: 'ACTIVE',
    score: computeFindingScore(raw),
    feedbackCount: 0,
  };

  findings.unshift(finding);

  // Expire old findings
  const expiryNow = new Date().toISOString();
  for (const f of findings) {
    if (f.expiresAt && f.expiresAt < expiryNow && f.status === 'ACTIVE') {
      f.status = 'EXPIRED';
    }
  }

  // Trim to max
  if (findings.length > MAX_FINDINGS) {
    findings.length = MAX_FINDINGS;
  }

  log('info', `[FeedStore] Finding stored: [${finding.severity}] ${finding.title} (score=${finding.score})`);
  return finding;
}

// ── Feed Queries ───────────────────────────────────────────────────────────────

export interface FeedQuery {
  categories?:  FindingCategory[];
  severities?:  FindingSeverity[];
  npis?:        string[];
  status?:      Finding['status'][];
  investigator?: string;
  limit?:       number;
  minScore?:    number;
}

export function queryFindings(query: FeedQuery = {}): Finding[] {
  let results = [...findings];

  if (query.categories?.length) {
    results = results.filter(f => query.categories!.includes(f.category));
  }
  if (query.severities?.length) {
    results = results.filter(f => query.severities!.includes(f.severity));
  }
  if (query.npis?.length) {
    const npiSet = new Set(query.npis);
    results = results.filter(f => f.npis.some(n => npiSet.has(n)));
  }
  if (query.status?.length) {
    results = results.filter(f => query.status!.includes(f.status));
  }
  if (query.investigator) {
    results = results.filter(f => f.investigator === query.investigator);
  }
  if (query.minScore) {
    results = results.filter(f => f.score >= query.minScore!);
  }

  // Sort by score descending, then recency
  results.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return results.slice(0, query.limit ?? 50);
}

export function getFindingById(id: string): Finding | null {
  return findings.find(f => f.id === id) ?? null;
}

export function getFindingsForNpi(npi: string): Finding[] {
  return queryFindings({ npis: [npi], status: ['ACTIVE'] });
}

export function getFeedStats(): {
  total: number;
  active: number;
  bySeverity: Record<FindingSeverity, number>;
  byCategory: Record<string, number>;
} {
  const active = findings.filter(f => f.status === 'ACTIVE');
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const f of active) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    byCategory[f.category] = (byCategory[f.category] ?? 0) + 1;
  }
  return {
    total: findings.length,
    active: active.length,
    bySeverity: bySeverity as Record<FindingSeverity, number>,
    byCategory,
  };
}

// ── User Feedback ──────────────────────────────────────────────────────────────

export type FeedbackAction = 'acknowledge' | 'dismiss' | 'escalate' | 'save' | 'compare' | 'follow_up';

export interface FeedbackRecord {
  findingId:   string;
  action:      FeedbackAction;
  userId?:     string;
  note?:       string;
  timestamp:   string;
}

const feedbackLog: FeedbackRecord[] = [];
const MAX_FEEDBACK = 1000;

// Suppression memory: dismissed category+investigator combos get deprioritized
const suppressionMemory = new Map<string, number>(); // key → dismiss count

export function recordFeedback(
  findingId: string,
  action: FeedbackAction,
  userId?: string,
  note?: string,
): Finding | null {
  const finding = getFindingById(findingId);
  if (!finding) return null;

  feedbackLog.push({
    findingId,
    action,
    userId,
    note,
    timestamp: new Date().toISOString(),
  });
  if (feedbackLog.length > MAX_FEEDBACK) feedbackLog.shift();

  finding.feedbackCount++;

  switch (action) {
    case 'acknowledge':
      finding.status = 'ACKNOWLEDGED';
      break;
    case 'dismiss': {
      finding.status = 'DISMISSED';
      // Track suppression
      const key = `${finding.investigator}:${finding.category}`;
      suppressionMemory.set(key, (suppressionMemory.get(key) ?? 0) + 1);
      // If dismissed 3+ times, deprioritize future findings from same source
      const dismissCount = suppressionMemory.get(key)!;
      if (dismissCount >= 3) {
        log('info', `[FeedStore] Suppression active for ${key} (${dismissCount} dismissals)`);
      }
      break;
    }
    case 'escalate':
      finding.status = 'ESCALATED';
      finding.score = Math.min(finding.score + 20, 100);
      break;
    case 'save':
      finding.status = 'ACKNOWLEDGED';
      break;
    case 'compare':
    case 'follow_up':
      // These don't change status — they're navigation actions
      break;
  }

  log('info', `[FeedStore] Feedback: ${action} on finding ${findingId}`);
  return finding;
}

export function getSuppressionScore(investigator: string, category: FindingCategory): number {
  const key = `${investigator}:${category}`;
  const dismissCount = suppressionMemory.get(key) ?? 0;
  // Each dismiss reduces score by 10, max 50 reduction
  return Math.min(dismissCount * 10, 50);
}

export function getFeedbackHistory(limit = 50): FeedbackRecord[] {
  return feedbackLog.slice(-limit).reverse();
}

// ── Investigator Registry ──────────────────────────────────────────────────────

const registry = new Map<string, Investigator>();

export function registerInvestigator(investigator: Investigator): void {
  registry.set(investigator.config.id, investigator);
  log('info', `[InvestigatorRegistry] Registered: ${investigator.config.id} (${investigator.config.name})`);
}

export function getInvestigator(id: string): Investigator | undefined {
  return registry.get(id);
}

export function listInvestigators(): InvestigatorConfig[] {
  return [...registry.values()].map(i => i.config);
}

export function getRegisteredInvestigators(): Investigator[] {
  return [...registry.values()];
}
