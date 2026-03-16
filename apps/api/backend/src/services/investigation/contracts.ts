import type {
  InvestigatorFindingDetail,
  InvestigatorFindingRecord,
} from '../../../../../../core/investigators/investigatorTypes';
import type { ProviderSummary } from '../../../../../../core/investigation/investigationEngine';
import type { GraphEdge, GraphNode } from '../graph-engine/schema';
import type { IntelligenceFeedItem } from '../intelligence/intelligenceDomain';
import type {
  StorylineActionEventContract,
  StorylineDetailContract,
  StorylineEntityLinkContract,
  StorylineFindingLinkContract,
  StorylineWithPredictionSnapshot,
} from '../storylines/storylineService';

export type InvestigatorRuntimePhase = 'ingest' | 'evaluate' | 'emit';

export type InvestigationRelationshipType =
  | 'co_author'
  | 'co_investigator'
  | 'financial'
  | 'institutional'
  | 'mentorship'
  | 'regulatory'
  | 'corporate'
  | 'unknown';

export type StorylineLifecycleStage =
  | 'emerging'
  | 'developing'
  | 'mature'
  | 'resolved'
  | 'archived';

export type InvestigatorLearningResolution =
  | 'true_positive_actionable'
  | 'true_positive_informational'
  | 'false_positive_data_error'
  | 'false_positive_threshold_too_sensitive'
  | 'false_positive_contextually_irrelevant'
  | 'inconclusive';

export interface InvestigatorSignalSubscription {
  signalClass: string;
  sources: string[];
  findingTypes?: string[];
  storylineTypes?: string[];
  relationshipTypes?: InvestigationRelationshipType[];
}

export interface InvestigatorCadenceMetadata {
  label: string;
  triggers: string[];
  cadenceMinutes: number;
  suppressionWindowMinutes: number;
  storylineWindowMinutes: number;
}

export interface InvestigatorConfidenceModel {
  label: string;
  inputs: string[];
  formula: string;
  explanation: string;
}

export interface InvestigatorStorylineMapping {
  storylineType: string;
  rationale: string;
}

export interface InvestigatorRuntimeDescriptor {
  id: string;
  name: string;
  purpose: string;
  phases: InvestigatorRuntimePhase[];
  engineInvestigatorIds: string[];
  subscriptions: InvestigatorSignalSubscription[];
  cadence: InvestigatorCadenceMetadata;
  findingTypes: string[];
  confidenceModel: InvestigatorConfidenceModel;
  storylineMappings: InvestigatorStorylineMapping[];
  workingMemoryKeys: string[];
  publishes: string[];
  subscribes: string[];
}

export interface FindingsBusEventContext {
  entityIds: string[];
  providerIds: string[];
  institutionIds: string[];
  storylineKey: string | null;
  findingType: string;
  severity: string;
  confidence: number;
  evidenceIds: string[];
  sourceIds: string[];
  observedAt: string;
  tags: string[];
}

export interface FindingsBusEvent {
  eventId: string;
  eventType: string;
  findingId: string;
  publisherInvestigatorId: string;
  findingTitle: string;
  summary: string;
  context: FindingsBusEventContext;
}

export interface FindingsBusDispatch {
  targetInvestigatorId: string;
  reason: string;
  eventType: string;
  contextKeys: string[];
}

export interface StorylineScoreBreakdown {
  maxFindingConfidence: number;
  findingCount: number;
  investigatorDiversity: number;
  recency: number;
  riskTierWeighting: number;
  total: number;
}

export interface StorylineScoreHistoryPoint {
  observedAt: string;
  score: number;
  confidence: number;
  label: string;
}

export interface StorylineMergeSuggestion {
  storylineId: string;
  title: string;
  similarityScore: number;
  reason: string;
}

export interface StorylineSplitSuggestion {
  key: string;
  label: string;
  findingIds: string[];
  rationale: string;
}

export interface StorylineTimelineNode {
  nodeId: string;
  eventType: string;
  label: string;
  occurredAt: string;
  findingIds: string[];
  evidenceRefs: string[];
}

export interface StorylineEvidenceRef {
  evidenceId: string;
  source: string;
  observedAt: string;
  findingId?: string;
  artifactId?: string;
  summary: string;
}

export interface StorylineNarrativeVersion {
  versionId: string;
  createdAt: string;
  label: string;
  narrative: string;
}

export interface AnalystAnnotation {
  annotationId: string;
  actorId: string | null;
  note: string | null;
  occurredAt: string;
  actionType: string;
}

export interface HardenedStorylineDetail {
  storyline: StorylineWithPredictionSnapshot;
  lifecycleStage: StorylineLifecycleStage;
  score: StorylineScoreBreakdown;
  scoreHistory: StorylineScoreHistoryPoint[];
  mergeSuggestions: StorylineMergeSuggestion[];
  splitSuggestions: StorylineSplitSuggestion[];
  timelineNodes: StorylineTimelineNode[];
  evidenceRefs: StorylineEvidenceRef[];
  linkedEntities: StorylineEntityLinkContract[];
  narrativeVersions: StorylineNarrativeVersion[];
  analystAnnotations: AnalystAnnotation[];
  findingLinks: StorylineFindingLinkContract[];
  statusEvents: StorylineDetailContract['statusEvents'];
  actionEvents: StorylineActionEventContract[];
}

export interface FindingsInboxRow {
  findingId: string;
  type: string;
  provider: string | null;
  investigatorSource: string;
  confidence: number;
  storylineRef: string | null;
  state: string;
  severity: string;
  timestamp: string;
  title: string;
  summary: string;
  busDispatches: FindingsBusDispatch[];
}

export interface FindingsInboxPayload {
  generatedAt: string;
  total: number;
  rows: FindingsInboxRow[];
}

export interface StorylineConsolePayload {
  generatedAt: string;
  storylineId: string;
  headline: string;
  summary: string;
  severityScore: number;
  lifecycleStage: StorylineLifecycleStage;
  timelineNodes: StorylineTimelineNode[];
  linkedProviders: string[];
  narrativeText: string;
  lastUpdated: string;
  mergeSuggestions: StorylineMergeSuggestion[];
  splitSuggestions: StorylineSplitSuggestion[];
  score: StorylineScoreBreakdown;
}

export interface EvidenceViewerPayload {
  evidenceId: string;
  evidenceType: string;
  provenance: string;
  source: string | null;
  retrievalMethod: string;
  retrievalTime: string | null;
  transformations: string[];
  snippet: string | null;
  url: string | null;
  recordType: string | null;
  recordId: string | null;
  relatedFindings: Array<{
    findingId: string;
    investigatorId: string;
    title: string;
    storylineKey: string;
  }>;
  metadata: Record<string, unknown>;
}

export interface NetworkGraphPath {
  pathId: string;
  nodeIds: string[];
  edgeIds: string[];
  relationshipTypes: InvestigationRelationshipType[];
  score: number;
  explanation: string;
}

export interface InvestigationGraphEdge extends GraphEdge {
  investigationRelationshipType: InvestigationRelationshipType;
  recencyWeight: number;
  relationshipStrength: number;
}

export interface NetworkGraphInvestigationPayload {
  generatedAt: string;
  focusNodeId: string | null;
  nodes: GraphNode[];
  edges: InvestigationGraphEdge[];
  highlights: {
    nodeIds: string[];
    edgeIds: string[];
  };
  paths: {
    shortestPath: NetworkGraphPath | null;
    rankedPaths: NetworkGraphPath[];
  };
  semanticZoom: {
    overviewClusters: Array<{
      id: string;
      label: string;
      nodeCount: number;
      edgeCount: number;
      nodeTypes: string[];
    }>;
    detailNodeCount: number;
    detailEdgeCount: number;
  };
}

export interface ProviderInvestigationPayload {
  generatedAt: string;
  providerId: string;
  providerSummary: ProviderSummary;
  findingsInbox: FindingsInboxPayload;
  storylines: StorylineConsolePayload[];
  feed: IntelligenceFeedItem[];
  network: NetworkGraphInvestigationPayload;
}

export interface StorylineInvestigationPayload {
  generatedAt: string;
  storylineId: string;
  detail: HardenedStorylineDetail;
  console: StorylineConsolePayload;
  findingsInbox: FindingsInboxPayload;
  feed: IntelligenceFeedItem[];
  network: NetworkGraphInvestigationPayload;
}

export interface InvestigationFeedItem extends IntelligenceFeedItem {
  rankingInputs: {
    analystRelevance: number;
    severity: number;
    recency: number;
    novelty: number;
    actionUrgency: number;
    total: number;
  };
}

export interface InvestigationFeedPayload {
  generatedAt: string;
  total: number;
  items: InvestigationFeedItem[];
}

export interface CopilotSignalCheckSummary {
  investigatorId: string;
  findingCount: number;
  lastObservedAt: string | null;
  confidence: number;
  summary: string;
}

export interface CopilotInvestigationPayload {
  generatedAt: string;
  objective: string;
  keyQuestions: string[];
  signalChecks: CopilotSignalCheckSummary[];
  evidenceSummary: Array<{
    label: string;
    detail: string;
    source: string;
    observedAt: string;
  }>;
  networkContext: {
    focusNodeId: string | null;
    highlights: string[];
    topPaths: NetworkGraphPath[];
  };
  confidenceAssessment: {
    score: number;
    level: 'low' | 'medium' | 'high';
    reasoning: string[];
  };
  recommendedAction: string;
  followUpQueries: string[];
}

export interface LearningCalibrationBucket {
  confidenceBucket: string;
  totalReviewed: number;
  actionableCount: number;
  falsePositiveCount: number;
  inconclusiveCount: number;
  falsePositiveRate: number;
  observedActionableRate: number;
  calibrationGap: number;
}

export interface LearningCalibrationSlice {
  investigatorId: string;
  findingType: string;
  buckets: LearningCalibrationBucket[];
  totalReviewed: number;
  falsePositiveRate: number;
}

export interface LearningCalibrationReport {
  generatedAt: string;
  totals: {
    reviewed: number;
    actionable: number;
    falsePositive: number;
    inconclusive: number;
    manualDiscoveryGapCount: number;
  };
  byInvestigator: LearningCalibrationSlice[];
  byFindingType: LearningCalibrationSlice[];
  rootCauseCounts: Record<string, number>;
}

export interface LearningFeedbackInput {
  findingId: string;
  resolution: InvestigatorLearningResolution;
  actorId?: string | null;
  note?: string | null;
  rootCause?: string | null;
  manualDiscoveryGap?: boolean;
  metadata?: Record<string, unknown>;
}

export interface LearningFeedbackResult {
  recordedAt: string;
  finding: InvestigatorFindingDetail;
  resolution: InvestigatorLearningResolution;
  confidenceBucket: string;
}

export interface InvestigatorRuntimeSummary {
  descriptor: InvestigatorRuntimeDescriptor;
  activeFindingCount: number;
  recentFindingCount: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  avgConfidence: number;
  learning: {
    reviewed: number;
    falsePositiveRate: number;
  };
}

export interface InvestigatorRuntimeDetail extends InvestigatorRuntimeSummary {
  recentFindings: InvestigatorFindingRecord[];
  recentBusEvents: Array<{
    event: FindingsBusEvent;
    dispatches: FindingsBusDispatch[];
  }>;
}
