// ── VitalCV Outcome Memory ─────────────────────────────────────────
// Builds intelligence from historic DecisionOutcomes to influence
// current and future system orchestration.

import { DecisionOutcome, OutcomeResult } from './decisionOutcome';

export interface OutcomePattern {
  totalDecisions: number;
  successRate: number; // percentage of STARTED
  averageTimeToStartMs: number;
  failureRate: number; // percentage of FAILED or DELAYED
  knownFailureTriggers: string[];
}

export interface OutcomeMemory {
  npi: string;
  orgId?: string;
  history: DecisionOutcome[];
  patterns: OutcomePattern;
}

function isResolvedOutcome(outcome: DecisionOutcome): boolean {
  return outcome.outcome !== OutcomeResult.PENDING;
}

/**
 * Synthesizes a raw list of DecisionOutcomes into actionable OutcomeMemory.
 */
export function buildOutcomeMemory(npi: string, outcomes: DecisionOutcome[], orgContext?: string): OutcomeMemory {
  const orgOutcomes = orgContext ? outcomes.filter(o => o.orgId === orgContext) : outcomes;
  const resolvedOutcomes = orgOutcomes.filter(isResolvedOutcome);

  if (resolvedOutcomes.length === 0) {
    return {
      npi,
      orgId: orgContext,
      history: [],
      patterns: {
        totalDecisions: 0,
        successRate: 0,
        averageTimeToStartMs: 0,
        failureRate: 0,
        knownFailureTriggers: []
      }
    };
  }

  const started = resolvedOutcomes.filter(o => o.outcome === OutcomeResult.STARTED);
  const failedOrDelayed = resolvedOutcomes.filter(
    o => o.outcome === OutcomeResult.FAILED || o.outcome === OutcomeResult.DELAYED,
  );
  
  let totalTime = 0;
  started.forEach(o => totalTime += (o.timeToStartMs || 0));
  
  // Extract known failure triggers based on action taken during failures
  const failureTriggers = new Set<string>();
  failedOrDelayed.forEach(o => {
    // In a real system, we would parse decisionStateHash or detailed logs.
    // For now, we correlate the action taken just before failure.
    if (o.actionTaken === 'REQUEST_DATA') failureTriggers.add('Missing Info Request Loops');
    if (o.actionTaken === 'ESCALATE') failureTriggers.add('High-Friction Manual Review');
  });

  return {
    npi,
    orgId: orgContext,
    history: resolvedOutcomes,
    patterns: {
      totalDecisions: resolvedOutcomes.length,
      successRate: started.length / resolvedOutcomes.length,
      averageTimeToStartMs: started.length > 0 ? totalTime / started.length : 0,
      failureRate: failedOrDelayed.length / resolvedOutcomes.length,
      knownFailureTriggers: Array.from(failureTriggers)
    }
  };
}

export const __testing__ = {
  isResolvedOutcome,
};
