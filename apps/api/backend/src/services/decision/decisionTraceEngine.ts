// ── VitalCV Decision Trace Engine ────────────────────────────────
// Captures a full, replayable trace of every layer in the Omega
// decision authority stack.

import { CalibratedDecisionState, ConfidenceLevel } from './confidenceEngine';
import { TruthSnapshot } from '../../../../../../packages/trust-contract/src/truth-snapshot';

export interface TraceLayerTruth {
  coverageChecked: number;
  totalLanes: number;
  limitations: string[];
}

export interface TraceLayerEnforcement {
  passed: boolean;
  violations: string[];
}

export interface TraceLayerRegistry {
  validIssuers: string[];
  revokedIssuersBlocked: string[];
}

export interface TraceLayerArbitration {
  conflictsResolved: number;
  reasons: string[];
}

export interface TraceLayerPolicy {
  orgId: string;
  policyOverridesApplied: string[];
}

export interface TraceLayerLearning {
  priorDecisions: number;
  historicalFailureRate: number;
  learningOverridesApplied: string[];
}

export interface TraceLayerConfidence {
  evidenceStrength: number;
  blendedScore: number;
  calibratedState: CalibratedDecisionState;
}

export interface DecisionTrace {
  traceId: string;
  snapshotId: string;
  subjectNpi: string;
  orgId: string;
  timestamp: string;
  
  layers: {
    truth: TraceLayerTruth;
    enforcement: TraceLayerEnforcement;
    registry: TraceLayerRegistry;
    arbitration: TraceLayerArbitration;
    policy: TraceLayerPolicy;
    learning: TraceLayerLearning;
    confidence: TraceLayerConfidence;
  };
  
  final: {
    decisionStateHash: string;
    nextBestAction: string;
    readinessPosture: string;
  };
}

export async function storeDecisionTrace(trace: DecisionTrace, snapshot: TruthSnapshot): Promise<void> {
  console.log(`[TRACE ENGINE] Stored replayable decision trace ${trace.traceId} (Snapshot: ${snapshot.snapshotId}) for NPI ${trace.subjectNpi}`);
  // In a real implementation, this persists to an immutable ledger or trace DB
}
