import type { PredictionInsight } from '../predictions/predictionEngine';
import { explainActionCandidates } from './actionExplainer';
import { generateActionCandidates } from './actionGenerator';
import { type ActionStatus } from './actionHistory';
import { rankActionCandidates } from './actionRanker';

export type ActionType =
  | 'RUN_VERIFICATION'
  | 'INVESTIGATE_PROVIDER'
  | 'COMPARE_WITH_PEERS'
  | 'ALERT_TEAM'
  | 'EXPORT_REPORT'
  | 'MONITOR_PROVIDER'
  | 'ESCALATE_RISK';

export type ActionPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionTargetEntity {
  entityType: string;
  entityId: string;
  entityLabel?: string | null;
}

export interface ActionEvidence {
  label: string;
  snippet?: string | null;
  source?: string | null;
}

export interface ActionStoryline {
  storylineKey: string;
  storylineType: string;
  title: string;
  narrative: string;
  severity: string;
  confidence: number;
  targetEntity: ActionTargetEntity;
  findingIds: string[];
  findingTypes: string[];
  supportingEvidence: ActionEvidence[];
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface ActionCandidate {
  actionType: ActionType;
  targetEntity: ActionTargetEntity;
  storylineKey?: string | null;
  sourceFindingIds: string[];
  predictionIds: string[];
  recommendedAction: string;
  reasonFragments: string[];
  evidence: ActionEvidence[];
  baseConfidence: number;
  riskWeight: number;
  urgencyWeight: number;
  opportunityWeight: number;
  entityImportance: number;
  recencyWeight: number;
  metadata: Record<string, unknown>;
}

export interface RankedActionCandidate extends ActionCandidate {
  priority: ActionPriority;
  priorityScore: number;
  confidence: number;
}

export interface RecommendedAction {
  actionId: string;
  actionType: ActionType;
  targetEntity: ActionTargetEntity;
  recommendedAction: string;
  priority: ActionPriority;
  priorityScore: number;
  confidence: number;
  explanation: string;
  createdAt: string;
  status: ActionStatus;
  storylineKey?: string | null;
  sourceFindingIds: string[];
  predictionIds: string[];
  evidence: ActionEvidence[];
  metadata: Record<string, unknown>;
}

export interface ActionEngineInput {
  storylines: readonly ActionStoryline[];
  predictions?: readonly PredictionInsight[];
  now?: string;
}

export function createActionEngine() {
  return {
    generate(input: ActionEngineInput): RecommendedAction[] {
      const now = input.now ?? new Date().toISOString();
      const candidates = generateActionCandidates(input.storylines, input.predictions ?? [], now);
      const ranked = rankActionCandidates(candidates, now);
      return explainActionCandidates(ranked, now);
    },
  };
}
