/**
 * intelligenceEngineService.ts — Intelligence feedback bridge
 *
 * Bridges trust/freshness/divergence events into the Intelligence Engine's
 * event bus. Accepts flexible parameter shapes from route handlers.
 */

import { emitIntelligenceEvent } from './intelligenceEngine';
import { log } from '../../obs/logger';

export async function recordTrustScoreSnapshot(params: Record<string, unknown>): Promise<void> {
  const npi = String(params.npi ?? params.subjectId ?? '');
  const score = Number(params.score ?? params.newScore ?? 0);
  const band = String(params.band ?? '');
  const confidence = Number(params.confidence ?? 0);
  await emitIntelligenceEvent({
    type: 'TRUST_SCORE_UPDATED', npi, loop: 1,
    payload: { score, band, confidence },
  });
  log('debug', `[IntelligenceBridge] Trust score snapshot: NPI ${npi} = ${score}`);
}

export async function recordFreshnessDecaySignals(params: Record<string, unknown>): Promise<void> {
  const npi = String(params.npi ?? params.subjectId ?? '');
  const staleDimensions = Number(params.staleDimensions ?? 0);
  if (staleDimensions > 0) {
    await emitIntelligenceEvent({
      type: 'FRESHNESS_DECAY', npi, loop: 2,
      payload: { overallFreshness: params.overallFreshness, staleDimensions, agingDimensions: params.agingDimensions },
    });
  }
}

export async function syncDivergenceReport(params: Record<string, unknown>): Promise<void> {
  const npi = String(params.npi ?? params.subjectId ?? '');
  const conflicts = Array.isArray(params.conflicts) ? params.conflicts.length : Number(params.conflicts ?? 0);
  const hasBlocking = Boolean(params.hasBlocking);
  if (conflicts > 0) {
    await emitIntelligenceEvent({
      type: 'DIVERGENCE_DETECTED', npi, loop: 2,
      payload: { conflicts, hasBlocking, totalPenalty: params.totalPenalty },
    });
  }
}

export async function recordSuggestionOutcome(params: Record<string, unknown>, _prisma?: unknown): Promise<void> {
  const action = params.accepted === true ? 'accept' : 'reject';
  await emitIntelligenceEvent({
    type: action === 'accept' ? 'AI_SUGGESTION_ACCEPTED' : 'AI_SUGGESTION_REJECTED',
    loop: 3,
    payload: { suggestionId: params.suggestionId ?? params.graphSuggestionId, strategy: params.suggestionType },
  });
}

// Stubs for functions imported by other agent's routes but not yet needed
export async function getSourceReliabilityScore(_params: Record<string, unknown>): Promise<Record<string, unknown>> {
  return { score: 1.0, source: 'stub' };
}
export async function listAnomalyHistory(_params: Record<string, unknown>): Promise<unknown[]> { return []; }
export async function listGraphInsights(_params?: Record<string, unknown>): Promise<unknown[]> { return []; }
export async function listTrustScoreHistory(_params: Record<string, unknown>): Promise<unknown[]> { return []; }
export async function recordAlertOutcome(_params: Record<string, unknown>): Promise<void> {}
export async function recordLearningSignal(_params: Record<string, unknown>): Promise<void> {}
export async function recordSourceIngestionFeedback(_params: Record<string, unknown>): Promise<void> {}
export async function rebuildGraphInsights(): Promise<{ count: number }> { return { count: 0 }; }
