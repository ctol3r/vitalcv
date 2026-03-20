import type { PredictionInsight } from '../predictions/predictionEngine';
import type { DecisionResult } from '../decisions/decisionEngine';
import { buildActionId } from './actionHistory';
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
  | 'ESCALATE_RISK'
  | 'VERIFY_CREDENTIAL'
  | 'INVESTIGATE_NETWORK'
  | 'REVIEW_INSTITUTION'
  | 'TRACK_SPECIALTY'
  | 'READY_TO_INTERVIEW'
  | 'REQUEST_CREDENTIAL'
  | 'RISK_ESCALATED'
  | 'CONTINUE_REVIEW';

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
  intelligenceActionType?: 'monitor_provider' | 'investigate_provider' | 'escalate_risk' | 'watch_specialty' | 'watch_institution';
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
  storylines?: readonly ActionStoryline[];
  predictions?: readonly PredictionInsight[];
  decisions?: readonly DecisionResult[];
  now?: string;
}

function decisionToActionPriority(priority: DecisionResult['priority']): ActionPriority {
  switch (priority) {
    case 'urgent':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'medium':
      return 'MEDIUM';
    case 'low':
    default:
      return 'LOW';
  }
}

function decisionPriorityScore(priority: DecisionResult['priority']): number {
  switch (priority) {
    case 'urgent':
      return 0.9;
    case 'high':
      return 0.72;
    case 'medium':
      return 0.52;
    case 'low':
    default:
      return 0.31;
  }
}

function decisionActionLabel(decision: DecisionResult): string {
  const targetLabel = decision.targetEntity.entityLabel ?? decision.targetEntity.entityId;
  switch (decision.recommendation) {
    case 'VERIFY_CREDENTIAL':
      return `Verify credential for ${targetLabel}`;
    case 'ESCALATE_RISK':
      return `Escalate risk for ${targetLabel}`;
    case 'MONITOR_PROVIDER':
      return `Monitor ${targetLabel}`;
    case 'INVESTIGATE_NETWORK':
      return `Investigate the network around ${targetLabel}`;
    case 'REVIEW_INSTITUTION':
      return `Review institution ${targetLabel}`;
    case 'TRACK_SPECIALTY':
      return `Track specialty pressure for ${targetLabel}`;
  }
}

function mapDecisionActions(decisions: readonly DecisionResult[]): RecommendedAction[] {
  return [...decisions]
    .map((decision) => {
      const actionType = decision.recommendation as ActionType;
      return {
        actionId: buildActionId({
          actionType,
          targetEntity: decision.targetEntity,
          storylineKey: decision.supportingStorylineKeys[0] ?? null,
          predictionIds: decision.supportingPredictionIds,
        }),
        actionType,
        targetEntity: decision.targetEntity,
        recommendedAction: decisionActionLabel(decision),
        priority: decisionToActionPriority(decision.priority),
        priorityScore: decisionPriorityScore(decision.priority),
        confidence: decision.confidence,
        explanation: decision.explanation,
        createdAt: decision.createdAt,
        status: 'pending' as ActionStatus,
        storylineKey: decision.supportingStorylineKeys[0] ?? null,
        sourceFindingIds: [...decision.supportingFindingIds],
        predictionIds: [...decision.supportingPredictionIds],
        evidence: decision.supportingSignals.map((signal) => ({
          label: signal.label,
          snippet: signal.value === undefined || signal.value === null ? undefined : String(signal.value),
          source: signal.source ?? undefined,
        })),
        metadata: {
          decisionId: decision.id,
          decisionType: decision.type,
          decisionPriority: decision.priority,
          ...decision.metadata,
        },
      };
    })
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      if (right.confidence !== left.confidence) {
        return right.confidence - left.confidence;
      }

      return left.actionId.localeCompare(right.actionId);
    });
}

export function createActionEngine() {
  return {
    generate(input: ActionEngineInput): RecommendedAction[] {
      if (input.decisions && input.decisions.length > 0) {
        return mapDecisionActions(input.decisions);
      }

      const now = input.now ?? new Date().toISOString();
      const candidates = generateActionCandidates(input.storylines ?? [], input.predictions ?? [], now);
      const ranked = rankActionCandidates(candidates, now);
      return explainActionCandidates(ranked, now);
    },
  };
}
