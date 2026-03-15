/**
 * actionEngine.ts — VitalCV Action + Prediction Engine
 *
 * Sits alongside findings and storylines as the "what should you do?"
 * and "what will happen next?" layer.
 *
 * Actions = recommended next steps derived from trust state
 * Predictions = forecasted trust/freshness/divergence trajectories
 *
 * Both are deterministic — no LLM. Computed from current state + history.
 */

import { log } from '../../obs/logger';
import { computeTrustScoreV1, type TrustScoreV1 } from '../trust/trustScoreV1';
import { computeTrustFreshness, type ClaimFreshnessReport } from '../identity/freshnessModel';
import { detectDivergence, type DivergenceReport } from '../identity/divergenceEngine';
import { getFindingsForNpi } from '../investigators/framework';
import { getStorylinesForNpi } from '../storylines/storylineEngine';

// ── Action Types ───────────────────────────────────────────────────────────────

export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ActionCategory =
  | 'REVERIFY'
  | 'RESOLVE_CONFLICT'
  | 'MONITOR'
  | 'INVESTIGATE'
  | 'ENRICH'
  | 'COMPARE'
  | 'ONBOARD'
  | 'ESCALATE';

export interface RecommendedAction {
  id:           string;
  category:     ActionCategory;
  priority:     ActionPriority;
  title:        string;
  description:  string;
  rationale:    string;          // Why this action matters
  impact:       string;          // What changes if acted upon
  npi:          string;
  endpoint?:    string;          // API endpoint to execute
  payload?:     Record<string, unknown>;
  estimatedImpact: number;      // Expected trust score change
  confidence:   number;          // 0–1
  expiresAt:    string | null;
  createdAt:    string;
}

// ── Prediction Types ───────────────────────────────────────────────────────────

export type PredictionType =
  | 'TRUST_TRAJECTORY'
  | 'FRESHNESS_EXPIRY'
  | 'DIVERGENCE_RISK'
  | 'BAND_TRANSITION'
  | 'EXCLUSION_RISK';

export type PredictionConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Prediction {
  id:           string;
  type:         PredictionType;
  npi:          string;
  title:        string;
  description:  string;
  timeframe:    string;          // "7 days", "30 days", etc.
  confidence:   PredictionConfidence;
  currentValue: number | string;
  predictedValue: number | string;
  direction:    'UP' | 'DOWN' | 'STABLE' | 'RISK';
  factors:      string[];        // Contributing factors
  actions:      string[];        // Action IDs that could alter this prediction
  createdAt:    string;
}

// ── Action Generation ──────────────────────────────────────────────────────────

let actionCounter = 0;
function makeActionId(): string {
  return `act_${Date.now().toString(36)}_${(++actionCounter).toString(36)}`;
}

let predictionCounter = 0;
function makePredictionId(): string {
  return `pred_${Date.now().toString(36)}_${(++predictionCounter).toString(36)}`;
}

function isUnverifiedDimension(score: TrustScoreV1, dimensionKey: string): boolean {
  const dimension = score.dimensions[dimensionKey as keyof TrustScoreV1['dimensions']];
  return dimension.score === 0
    && (
      dimension.status === 'UNKNOWN'
      || dimension.status === 'UNVERIFIED'
      || dimension.status === 'NOT_CHECKED'
      || dimension.sources.length === 0
    );
}

/**
 * Generate recommended actions for a provider based on current trust state.
 */
export async function generateActions(npi: string): Promise<RecommendedAction[]> {
  const [score, freshness, divergence] = await Promise.all([
    computeTrustScoreV1(npi),
    computeTrustFreshness(npi),
    detectDivergence(npi),
  ]);

  const actions: RecommendedAction[] = [];
  const now = new Date().toISOString();

  // ── Stale verification actions ───────────────────────────────────────────
  for (const stale of freshness.staleDimensions) {
    const isCritical = stale.scoreImpact === 'SEVERE';
    actions.push({
      id: makeActionId(),
      category: 'REVERIFY',
      priority: isCritical ? 'CRITICAL' : 'HIGH',
      title: `Re-verify ${stale.label}`,
      description: `${stale.label} verification is stale (freshness: ${Math.round(stale.freshnessScore * 100)}%). Re-verification will restore the freshness score component.`,
      rationale: isCritical
        ? `CRITICAL: ${stale.label} staleness directly impacts trust band. Exclusion/sanctions checks should never go stale.`
        : `${stale.label} is aging past the acceptable window. Each day of staleness reduces trust score impact.`,
      impact: `Expected trust score improvement: +${isCritical ? '5–10' : '2–5'} points on the freshness dimension.`,
      npi,
      endpoint: `POST /api/intelligence/ingest/${npi}`,
      payload: { dimensions: [stale.claimClass] },
      estimatedImpact: isCritical ? 8 : 3,
      confidence: 0.85,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    });
  }

  // ── Divergence resolution actions ────────────────────────────────────────
  for (const conflict of divergence.conflicts) {
    const isCritical = conflict.severity === 'CRITICAL';
    actions.push({
      id: makeActionId(),
      category: 'RESOLVE_CONFLICT',
      priority: isCritical ? 'CRITICAL' : 'HIGH',
      title: `Resolve ${conflict.severity} conflict: ${conflict.description.slice(0, 60)}`,
      description: `Cross-source conflict detected between ${conflict.sources.join(' and ')}. Penalty: −${conflict.penalty} pts.`,
      rationale: isCritical
        ? 'CRITICAL conflict caps trust band at L1. Resolution is required for L2+ certification.'
        : `MODERATE conflict reduces trust score by ${conflict.penalty} points. Resolution improves overall confidence.`,
      impact: `Resolving this conflict would restore +${conflict.penalty} trust score points.`,
      npi,
      estimatedImpact: conflict.penalty,
      confidence: 0.9,
      expiresAt: null,
      createdAt: now,
    });
  }

  // ── Gap-filling actions ──────────────────────────────────────────────────
  for (const [key, dim] of Object.entries(score.dimensions)) {
    if (isUnverifiedDimension(score, key)) {
      actions.push({
        id: makeActionId(),
        category: 'ENRICH',
        priority: dim.max >= 15 ? 'HIGH' : 'MEDIUM',
        title: `Add ${key} verification`,
        description: `${key} dimension has no verification data. Adding a source would contribute up to ${dim.max} points.`,
        rationale: `${key} is worth ${dim.max} points in the trust score. Currently scoring ${dim.score}/${dim.max}.`,
        impact: `Full verification could add up to +${dim.max - dim.score} points.`,
        npi,
        endpoint: `POST /api/intelligence/ingest/${npi}`,
        estimatedImpact: dim.max - dim.score,
        confidence: 0.7,
        expiresAt: null,
        createdAt: now,
      });
    }
  }

  // ── Band transition action ───────────────────────────────────────────────
  const pointsToNext: Record<string, { target: string; needed: number }> = {
    L0: { target: 'L1', needed: Math.max(40 - score.score, 0) },
    L1: { target: 'L2', needed: Math.max(60 - score.score, 0) },
    L2: { target: 'L3', needed: Math.max(80 - score.score, 0) },
  };

  const transition = pointsToNext[score.band];
  if (transition && transition.needed > 0 && transition.needed <= 20) {
    actions.push({
      id: makeActionId(),
      category: 'ONBOARD',
      priority: 'MEDIUM',
      title: `${transition.needed} pts to reach ${transition.target}`,
      description: `Provider is ${transition.needed} points away from ${transition.target} band. Completing the top recommended verifications could achieve this.`,
      rationale: `Band transition from ${score.band} to ${transition.target} unlocks higher trust confidence for verifiers.`,
      impact: `Trust band upgrade: ${score.band} → ${transition.target}`,
      npi,
      estimatedImpact: transition.needed,
      confidence: 0.6,
      expiresAt: null,
      createdAt: now,
    });
  }

  // ── Storyline-driven monitoring ──────────────────────────────────────────
  const storylines = getStorylinesForNpi(npi);
  if (storylines.some(s => s.stage === 'DEVELOPING' || s.stage === 'MATURE')) {
    actions.push({
      id: makeActionId(),
      category: 'MONITOR',
      priority: 'MEDIUM',
      title: 'Active storyline — monitor closely',
      description: `This provider has ${storylines.length} active storyline(s). Trust trajectory may be changing.`,
      rationale: 'Evolving storylines indicate ongoing changes. Monitoring prevents surprises.',
      impact: 'Early detection of trust degradation or improvement.',
      npi,
      estimatedImpact: 0,
      confidence: 0.75,
      expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
    });
  }

  // Sort by priority then estimated impact
  const priorityRank: Record<ActionPriority, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  actions.sort((a, b) => {
    const pr = priorityRank[a.priority] - priorityRank[b.priority];
    if (pr !== 0) return pr;
    return b.estimatedImpact - a.estimatedImpact;
  });

  return actions;
}

// ── Prediction Generation ──────────────────────────────────────────────────────

/**
 * Generate predictions for a provider's trust trajectory.
 */
export async function generatePredictions(npi: string): Promise<Prediction[]> {
  const [score, freshness, divergence] = await Promise.all([
    computeTrustScoreV1(npi),
    computeTrustFreshness(npi),
    detectDivergence(npi),
  ]);

  const predictions: Prediction[] = [];
  const now = new Date().toISOString();
  const findings = getFindingsForNpi(npi);
  const storylines = getStorylinesForNpi(npi);

  // ── Trust trajectory prediction ──────────────────────────────────────────
  {
    const stalePenalty = freshness.staleDimensions.length * 3;
    const agingPenalty = freshness.agingDimensions.length * 1;
    const conflictRisk = divergence.conflicts.length > 0 ? divergence.totalPenalty : 0;
    const activeStorylines = storylines.filter(s => s.severity === 'HIGH' || s.severity === 'CRITICAL').length;
    const riskSignals = stalePenalty + agingPenalty + conflictRisk + (activeStorylines * 5);

    let predictedScore: number;
    let direction: Prediction['direction'];
    let confidence: PredictionConfidence;

    if (riskSignals >= 20) {
      predictedScore = Math.max(score.score - Math.round(riskSignals * 0.5), 0);
      direction = 'DOWN';
      confidence = 'HIGH';
    } else if (riskSignals >= 10) {
      predictedScore = Math.max(score.score - Math.round(riskSignals * 0.3), 0);
      direction = 'DOWN';
      confidence = 'MEDIUM';
    } else if (riskSignals === 0 && score.score < 80) {
      predictedScore = Math.min(score.score + 5, 100);
      direction = 'UP';
      confidence = 'LOW';
    } else {
      predictedScore = score.score;
      direction = 'STABLE';
      confidence = 'MEDIUM';
    }

    const factors: string[] = [];
    if (stalePenalty > 0) factors.push(`${freshness.staleDimensions.length} stale verification(s)`);
    if (agingPenalty > 0) factors.push(`${freshness.agingDimensions.length} aging verification(s)`);
    if (conflictRisk > 0) factors.push(`${divergence.conflicts.length} cross-source conflict(s)`);
    if (activeStorylines > 0) factors.push(`${activeStorylines} high-severity storyline(s)`);
    if (factors.length === 0) factors.push('No risk signals detected');

    predictions.push({
      id: makePredictionId(),
      type: 'TRUST_TRAJECTORY',
      npi,
      title: `Trust score ${direction === 'DOWN' ? 'likely to decline' : direction === 'UP' ? 'may improve' : 'expected stable'}`,
      description: `Current: ${score.score}/100 (${score.bandLabel}). Predicted: ${predictedScore}/100 in 7 days.`,
      timeframe: '7 days',
      confidence,
      currentValue: score.score,
      predictedValue: predictedScore,
      direction,
      factors,
      actions: [],
      createdAt: now,
    });
  }

  // ── Freshness expiry predictions ─────────────────────────────────────────
  for (const aging of freshness.agingDimensions) {
    const daysToStale = Math.round((1 - aging.freshnessScore) * 30); // rough estimate
    if (daysToStale <= 14) {
      predictions.push({
        id: makePredictionId(),
        type: 'FRESHNESS_EXPIRY',
        npi,
        title: `${aging.label} verification approaching stale`,
        description: `${aging.label} freshness is ${Math.round(aging.freshnessScore * 100)}%. Estimated ${daysToStale} day(s) until stale threshold.`,
        timeframe: `${daysToStale} days`,
        confidence: 'MEDIUM',
        currentValue: `${Math.round(aging.freshnessScore * 100)}%`,
        predictedValue: 'STALE',
        direction: 'DOWN',
        factors: [`Linear decay: ${aging.label} aging window`],
        actions: [],
        createdAt: now,
      });
    }
  }

  // ── Band transition prediction ───────────────────────────────────────────
  const bandOrder = ['L0', 'L1', 'L2', 'L3'];
  const currentIdx = bandOrder.indexOf(score.band);
  if (currentIdx > 0 && predictions.some(p => p.direction === 'DOWN' && p.confidence !== 'LOW')) {
    const lowerBand = bandOrder[currentIdx - 1]!;
    const threshold = [0, 40, 60, 80][currentIdx]!;
    const margin = score.score - threshold;

    if (margin <= 10) {
      predictions.push({
        id: makePredictionId(),
        type: 'BAND_TRANSITION',
        npi,
        title: `Risk of band downgrade: ${score.band} → ${lowerBand}`,
        description: `Only ${margin} points above the ${lowerBand}/${score.band} threshold (${threshold} pts). Active risk signals may push score below.`,
        timeframe: '7–14 days',
        confidence: margin <= 5 ? 'HIGH' : 'MEDIUM',
        currentValue: score.band,
        predictedValue: lowerBand,
        direction: 'RISK',
        factors: [`${margin} pt margin above threshold`, ...predictions[0]?.factors ?? []],
        actions: [],
        createdAt: now,
      });
    }
  }

  // ── Divergence risk prediction ───────────────────────────────────────────
  if (divergence.conflicts.length === 0 && freshness.staleDimensions.length >= 2) {
    predictions.push({
      id: makePredictionId(),
      type: 'DIVERGENCE_RISK',
      npi,
      title: 'Divergence risk increasing',
      description: `${freshness.staleDimensions.length} stale dimensions increase the probability of undetected cross-source conflicts.`,
      timeframe: '14 days',
      confidence: 'LOW',
      currentValue: 0,
      predictedValue: 'POSSIBLE',
      direction: 'RISK',
      factors: [`${freshness.staleDimensions.length} stale verification(s) may mask conflicts`],
      actions: [],
      createdAt: now,
    });
  }

  return predictions;
}

// ── Combined Provider Intelligence ─────────────────────────────────────────────

export interface ProviderIntelligence {
  npi:          string;
  actions:      RecommendedAction[];
  predictions:  Prediction[];
  summary:      string;
  generatedAt:  string;
  durationMs:   number;
}

/**
 * Generate full action + prediction intelligence for a provider.
 */
export async function getProviderIntelligence(npi: string): Promise<ProviderIntelligence> {
  const startMs = Date.now();

  const [actions, predictions] = await Promise.all([
    generateActions(npi),
    generatePredictions(npi),
  ]);

  // Build summary
  const criticalActions = actions.filter(a => a.priority === 'CRITICAL');
  const downPredictions = predictions.filter(p => p.direction === 'DOWN' || p.direction === 'RISK');

  let summary = '';
  if (criticalActions.length > 0) {
    summary += `⚠️ ${criticalActions.length} critical action(s) required. `;
  }
  if (downPredictions.length > 0) {
    summary += `📉 ${downPredictions.length} declining/risk prediction(s). `;
  }
  if (criticalActions.length === 0 && downPredictions.length === 0) {
    summary = '✅ No urgent actions. Trust trajectory stable.';
  }

  return {
    npi,
    actions,
    predictions,
    summary: summary.trim(),
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startMs,
  };
}

// ── Action Feedback ────────────────────────────────────────────────────────────

export type ActionOutcome = 'completed' | 'skipped' | 'deferred' | 'failed';

interface ActionFeedbackRecord {
  actionId:    string;
  category:    ActionCategory;
  outcome:     ActionOutcome;
  npi:         string;
  timestamp:   string;
}

const actionFeedback: ActionFeedbackRecord[] = [];
const MAX_ACTION_FEEDBACK = 500;

// Track which action categories get completed vs skipped
const categoryOutcomes = new Map<ActionCategory, { completed: number; skipped: number; deferred: number }>();

export function recordActionOutcome(
  actionId: string,
  category: ActionCategory,
  outcome: ActionOutcome,
  npi: string,
): void {
  actionFeedback.push({
    actionId, category, outcome, npi,
    timestamp: new Date().toISOString(),
  });
  if (actionFeedback.length > MAX_ACTION_FEEDBACK) actionFeedback.shift();

  const counts = categoryOutcomes.get(category) ?? { completed: 0, skipped: 0, deferred: 0 };
  if (outcome === 'completed') counts.completed++;
  else if (outcome === 'skipped') counts.skipped++;
  else if (outcome === 'deferred') counts.deferred++;
  categoryOutcomes.set(category, counts);

  log('info', `[ActionEngine] Feedback: ${outcome} on ${actionId} (${category})`);
}

/**
 * Get completion rates by category — used to tune action ranking.
 */
export function getActionCompletionRates(): Record<string, { completed: number; skipped: number; deferred: number; rate: number }> {
  const result: Record<string, { completed: number; skipped: number; deferred: number; rate: number }> = {};
  for (const [cat, counts] of categoryOutcomes) {
    const total = counts.completed + counts.skipped + counts.deferred;
    result[cat] = { ...counts, rate: total > 0 ? counts.completed / total : 0 };
  }
  return result;
}

export function getActionFeedbackHistory(limit = 50): ActionFeedbackRecord[] {
  return actionFeedback.slice(-limit).reverse();
}
