/**
 * learningLoopService.ts — Investigator Learning Loop
 *
 * Captures analyst resolution outcomes to calibrate investigator accuracy
 * over time. This is the feedback signal that closes the loop:
 *
 *   Investigator emits finding
 *     → Analyst reviews in workbench
 *     → Analyst records outcome (TP / FP / inconclusive / etc.)
 *     → Learning loop adjusts suppression weights
 *     → Future findings from same investigator/category are better ranked
 *
 * Architecture:
 *   - In-memory store (survives restarts only if persisted externally)
 *   - Does NOT modify Prisma schema
 *   - Integrates with FeedStore suppression via getCalibrationBias()
 *   - Feeds calibration reports for operator visibility
 *
 * Resolution Outcomes:
 *   RESOLVED_TRUE_POSITIVE  — finding was valid and acted upon
 *   RESOLVED_FALSE_POSITIVE — finding was incorrect / not actionable
 *   RESOLVED_INCONCLUSIVE   — cannot determine validity
 *   ESCALATED               — forwarded for further review (treated as TP signal)
 *   MONITORING              — watching for recurrence
 *
 * Evidence Quality:
 *   STRONG   — multiple corroborating primary sources
 *   ADEQUATE — single primary source with context
 *   WEAK     — secondary/inferred only
 *   MISSING  — no supporting evidence
 */

import { log } from '../../obs/logger';
import {
  getFindingById,
  getSuppressionScore,
  type Finding,
} from './framework';
import { getInvestigatorFinding } from './investigatorEngineService';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ResolutionOutcome =
  | 'RESOLVED_TRUE_POSITIVE'
  | 'RESOLVED_FALSE_POSITIVE'
  | 'RESOLVED_INCONCLUSIVE'
  | 'ESCALATED'
  | 'MONITORING';

export type EvidenceQuality = 'STRONG' | 'ADEQUATE' | 'WEAK' | 'MISSING';

export interface OutcomeRecord {
  outcomeId: string;
  findingId: string;
  investigatorId: string;
  findingType: string;
  severity: string;
  outcome: ResolutionOutcome;
  evidenceQuality: EvidenceQuality;
  falsePositiveReason?: string;
  missedSignals?: string[];
  analystNote?: string;
  resolvedAt: string;
  resolvedBy?: string;
}

export interface InvestigatorCalibrationStats {
  investigatorId: string;
  totalResolved: number;
  truePositiveCount: number;
  falsePositiveCount: number;
  escalatedCount: number;
  inconclusiveCount: number;
  truePositiveRate: number;
  falsePositiveRate: number;
  inconclusiveRate: number;
  averageEvidenceQuality: number; // 0–1
  topFalsePositiveReasons: Array<{ reason: string; count: number }>;
  calibrationScore: number;       // 0–100
  feedbackBias: number;           // -50 to +20 (negative = suppress, positive = boost)
  lastUpdatedAt: string;
}

export interface LearningLoopStats {
  totalOutcomes: number;
  resolvedTodayCount: number;
  overallTruePositiveRate: number;
  overallFalsePositiveRate: number;
  worstPerformingInvestigators: string[];
  bestPerformingInvestigators: string[];
  generatedAt: string;
}

// ── In-memory store ────────────────────────────────────────────────────────────

const outcomes: OutcomeRecord[] = [];
const MAX_OUTCOMES = 2000;
let outcomeCounter = 0;

function makeOutcomeId(): string {
  return `out_${Date.now().toString(36)}_${(++outcomeCounter).toString(36)}`;
}

// ── Evidence quality scoring ───────────────────────────────────────────────────

function evidenceQualityScore(quality: EvidenceQuality): number {
  switch (quality) {
    case 'STRONG':   return 1.0;
    case 'ADEQUATE': return 0.65;
    case 'WEAK':     return 0.30;
    case 'MISSING':  return 0.0;
  }
}

// ── Core API ───────────────────────────────────────────────────────────────────

export async function recordOutcome(
  findingId: string,
  outcome: ResolutionOutcome,
  evidenceQuality: EvidenceQuality,
  options?: {
    falsePositiveReason?: string;
    missedSignals?: string[];
    analystNote?: string;
    resolvedBy?: string;
    resolvedAt?: string;
  },
): Promise<OutcomeRecord | null> {
  // Try DB-backed finding first, then in-memory
  let investigatorId = 'unknown';
  let findingType = 'unknown';
  let severity = 'medium';

  try {
    const dbFinding = await getInvestigatorFinding(findingId);
    if (dbFinding) {
      investigatorId = dbFinding.investigatorId;
      findingType = dbFinding.findingType;
      severity = dbFinding.severity;
    }
  } catch {
    // Fall back to in-memory
    const memFinding: Finding | null = getFindingById(findingId);
    if (memFinding) {
      investigatorId = memFinding.investigator;
      findingType = memFinding.category;
      severity = memFinding.severity;
    } else {
      log('warn', `[LearningLoop] Finding not found: ${findingId}`);
      return null;
    }
  }

  const resolvedAt = (() => {
    const candidate = options?.resolvedAt?.trim();
    if (!candidate) {
      return new Date().toISOString();
    }

    const parsed = new Date(candidate);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('resolvedAt must be a valid ISO timestamp when provided');
    }

    return parsed.toISOString();
  })();

  const existingIndex = outcomes.findIndex((record) => record.findingId === findingId);
  if (existingIndex >= 0) {
    const existing = outcomes[existingIndex]!;
    const nextMissedSignals = options?.missedSignals ?? existing.missedSignals;
    const samePayload =
      existing.outcome === outcome &&
      existing.evidenceQuality === evidenceQuality &&
      existing.falsePositiveReason === options?.falsePositiveReason &&
      existing.analystNote === options?.analystNote &&
      existing.resolvedBy === options?.resolvedBy &&
      JSON.stringify(existing.missedSignals ?? []) === JSON.stringify(nextMissedSignals ?? []);

    if (samePayload && !options?.resolvedAt) {
      return existing;
    }

    const updated: OutcomeRecord = {
      ...existing,
      outcome,
      evidenceQuality,
      falsePositiveReason: options?.falsePositiveReason,
      missedSignals: nextMissedSignals,
      analystNote: options?.analystNote,
      resolvedAt,
      resolvedBy: options?.resolvedBy,
    };

    outcomes.splice(existingIndex, 1);
    outcomes.unshift(updated);

    log('info', `[LearningLoop] Outcome updated: ${outcome} for finding ${findingId} (${investigatorId})`);
    return updated;
  }

  const record: OutcomeRecord = {
    outcomeId: makeOutcomeId(),
    findingId,
    investigatorId,
    findingType,
    severity,
    outcome,
    evidenceQuality,
    falsePositiveReason: options?.falsePositiveReason,
    missedSignals: options?.missedSignals,
    analystNote: options?.analystNote,
    resolvedAt,
    resolvedBy: options?.resolvedBy,
  };

  outcomes.unshift(record);
  if (outcomes.length > MAX_OUTCOMES) outcomes.length = MAX_OUTCOMES;

  log('info', `[LearningLoop] Outcome recorded: ${outcome} for finding ${findingId} (${investigatorId})`);
  return record;
}

export function getCalibrationStats(investigatorId?: string): InvestigatorCalibrationStats[] {
  // Group outcomes by investigatorId
  const groups = new Map<string, OutcomeRecord[]>();
  for (const record of outcomes) {
    if (investigatorId && record.investigatorId !== investigatorId) continue;
    const group = groups.get(record.investigatorId) ?? [];
    group.push(record);
    groups.set(record.investigatorId, group);
  }

  return [...groups.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([id, records]) => {
      const total = records.length;
      const tpCount = records.filter(r => r.outcome === 'RESOLVED_TRUE_POSITIVE').length;
      const escalatedCount = records.filter(r => r.outcome === 'ESCALATED').length;
      const fpCount = records.filter(r => r.outcome === 'RESOLVED_FALSE_POSITIVE').length;
      const inconclusiveCount = records.filter(r => r.outcome === 'RESOLVED_INCONCLUSIVE').length;
      const positiveSignalCount = tpCount + escalatedCount;
      const tpRate = total > 0 ? positiveSignalCount / total : 0;
      const fpRate = total > 0 ? fpCount / total : 0;
      const avgEvidence = records.reduce((s, r) => s + evidenceQualityScore(r.evidenceQuality), 0) / Math.max(total, 1);

      // FP reason aggregation
      const fpReasons = new Map<string, number>();
      for (const r of records) {
        if (r.outcome === 'RESOLVED_FALSE_POSITIVE' && r.falsePositiveReason) {
          fpReasons.set(r.falsePositiveReason, (fpReasons.get(r.falsePositiveReason) ?? 0) + 1);
        }
      }
      const topFpReasons = [...fpReasons.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([reason, count]) => ({ reason, count }));

      const lastUpdatedAt = records.reduce<string>((latest, record) => {
        return latest.localeCompare(record.resolvedAt) >= 0 ? latest : record.resolvedAt;
      }, records[0]?.resolvedAt ?? new Date(0).toISOString());

      // Calibration score: rewards TP, penalizes FP, factors evidence quality
      const calibrationScore = Math.round(
        Math.max(0, Math.min(100,
          (tpRate * 65) + (avgEvidence * 25) + ((1 - fpRate) * 10),
        )),
      );

      // Feedback bias: suppression offset for FeedStore
      // Positive = boost score, Negative = suppress score
      const feedbackBias = total >= 5
        ? Math.round(((tpRate - fpRate) * 20) - ((1 - avgEvidence) * 10))
        : 0; // No bias until we have enough data

      return {
        investigatorId: id,
        totalResolved: total,
        truePositiveCount: tpCount,
        falsePositiveCount: fpCount,
        escalatedCount,
        inconclusiveCount,
        truePositiveRate: tpRate,
        falsePositiveRate: fpRate,
        inconclusiveRate: total > 0 ? inconclusiveCount / total : 0,
        averageEvidenceQuality: avgEvidence,
        topFalsePositiveReasons: topFpReasons,
        calibrationScore,
        feedbackBias,
        lastUpdatedAt,
      };
    });
}

export function getLearningLoopStats(): LearningLoopStats {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayCount = outcomes.filter(o => o.resolvedAt >= todayStart).length;

  const allStats = getCalibrationStats();
  const withEnoughData = allStats.filter(s => s.totalResolved >= 3);

  const worstPerforming = [...withEnoughData]
    .sort((a, b) => a.calibrationScore - b.calibrationScore || a.investigatorId.localeCompare(b.investigatorId))
    .slice(0, 3)
    .map(s => s.investigatorId);

  const bestPerforming = [...withEnoughData]
    .sort((a, b) => b.calibrationScore - a.calibrationScore || a.investigatorId.localeCompare(b.investigatorId))
    .slice(0, 3)
    .map(s => s.investigatorId);

  const total = outcomes.length;
  const tpTotal = outcomes.filter(
    o => o.outcome === 'RESOLVED_TRUE_POSITIVE' || o.outcome === 'ESCALATED',
  ).length;
  const fpTotal = outcomes.filter(o => o.outcome === 'RESOLVED_FALSE_POSITIVE').length;

  return {
    totalOutcomes: total,
    resolvedTodayCount: todayCount,
    overallTruePositiveRate: total > 0 ? tpTotal / total : 0,
    overallFalsePositiveRate: total > 0 ? fpTotal / total : 0,
    worstPerformingInvestigators: worstPerforming,
    bestPerformingInvestigators: bestPerforming,
    generatedAt: new Date().toISOString(),
  };
}

export function getOutcomeHistory(
  limit = 50,
  investigatorId?: string,
): OutcomeRecord[] {
  const filtered = investigatorId
    ? outcomes.filter(o => o.investigatorId === investigatorId)
    : outcomes;
  return [...filtered]
    .sort((a, b) => b.resolvedAt.localeCompare(a.resolvedAt) || a.outcomeId.localeCompare(b.outcomeId))
    .slice(0, limit);
}

// Validation helpers for route handlers
export const VALID_OUTCOMES: ResolutionOutcome[] = [
  'RESOLVED_TRUE_POSITIVE',
  'RESOLVED_FALSE_POSITIVE',
  'RESOLVED_INCONCLUSIVE',
  'ESCALATED',
  'MONITORING',
];

export const VALID_EVIDENCE_QUALITIES: EvidenceQuality[] = [
  'STRONG',
  'ADEQUATE',
  'WEAK',
  'MISSING',
];

export function isValidOutcome(v: unknown): v is ResolutionOutcome {
  return typeof v === 'string' && (VALID_OUTCOMES as string[]).includes(v);
}

export function isValidEvidenceQuality(v: unknown): v is EvidenceQuality {
  return typeof v === 'string' && (VALID_EVIDENCE_QUALITIES as string[]).includes(v);
}

export function resetLearningLoopForTests(): void {
  outcomes.length = 0;
  outcomeCounter = 0;
}
