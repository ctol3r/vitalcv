export type DecisionTargetEntityType =
  | 'provider'
  | 'storyline'
  | 'institution'
  | 'specialty'
  | 'network_cluster';

export type DecisionActionType =
  | 'REVIEW_NOW'
  | 'MONITOR'
  | 'ESCALATE'
  | 'COMPARE_WITH_PEERS'
  | 'VERIFY_SOURCE'
  | 'REQUEST_MORE_EVIDENCE'
  | 'PRIORITIZE_OUTREACH'
  | 'DEFER_ACTION'
  | 'SAVE_TO_WATCHLIST';

export type DecisionPriority = 'critical' | 'high' | 'medium' | 'low';

export type DecisionRecommendationState =
  | 'new'
  | 'accepted'
  | 'dismissed'
  | 'deferred'
  | 'completed';

export type DecisionSignalKind = 'finding' | 'storyline' | 'prediction' | 'graph';

export type DecisionSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export type DecisionPredictionDirection = 'UP' | 'DOWN' | 'FLAT' | 'SHIFT';

export interface DecisionTargetEntity {
  entityType: DecisionTargetEntityType;
  entityId: string;
  entityLabel?: string | null;
}

export interface DecisionSignalReference {
  signalId: string;
  kind: DecisionSignalKind;
  signalType: string;
  label: string;
  value?: number | string | null;
  confidence: number;
  observedAt: string;
  severity?: DecisionSeverity;
  direction?: DecisionPredictionDirection;
  corroboration?: number;
  sources?: string[];
  sourceIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface DecisionInputSignal extends DecisionSignalReference {
  targetEntity: DecisionTargetEntity;
  novelty?: number;
  value?: number;
  historicalTruthRate?: number | null;
}

export interface DecisionGraphContext {
  targetEntity: DecisionTargetEntity;
  centrality: number;
  clusterCount?: number;
  recentConnectionDelta?: number;
  corroboration?: number;
  observedAt: string;
  metadata?: Record<string, unknown>;
}

export interface DecisionScoreBreakdown {
  severity: number;
  novelty: number;
  predictionDirection: number;
  centrality: number;
  confidence: number;
  corroboration: number;
  recency: number;
  historicalTruthRate: number;
  ruleAdjustment: number;
  total: number;
}

export interface DecisionExplainability {
  why: string;
  urgency: string;
  watchNext: string;
  heuristic: boolean;
  observedFacts: string[];
  predictions: string[];
}

export interface DecisionRecommendation {
  decisionId: string;
  actionType: DecisionActionType;
  targetEntity: DecisionTargetEntity;
  priority: DecisionPriority;
  priorityScore: number;
  confidence: number;
  title: string;
  rationale: string;
  supportingSignals: DecisionSignalReference[];
  recommendedTiming: string;
  state: DecisionRecommendationState;
  explainability: DecisionExplainability;
  scoreBreakdown: DecisionScoreBreakdown;
  createdAt: string;
  updatedAt: string;
  actedOnAt: string | null;
  feedbackNote: string | null;
  metadata: Record<string, unknown>;
}

export interface DecisionEngineInput {
  findings: readonly DecisionInputSignal[];
  storylines: readonly DecisionInputSignal[];
  predictions: readonly DecisionInputSignal[];
  graphContext: readonly DecisionGraphContext[];
  now?: string;
}
