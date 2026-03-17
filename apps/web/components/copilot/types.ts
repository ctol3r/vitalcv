'use client';

import type { CopilotDocument as ServerCopilotDocument } from '@/lib/copilot/contracts';
import type { TrustSignalSummary } from '@/lib/intelligence/trust-signals';

export type CopilotScope = 'provider' | 'finding' | 'storyline' | 'graph' | 'global';
export type CopilotStatus = 'ok' | 'limited';
export type CopilotMode = 'summary' | 'plan' | 'check' | 'compare' | 'network' | 'history';
export type CopilotSectionId =
  | 'summary'
  | 'evidence'
  | 'signals'
  | 'network_context'
  | 'recommended_action'
  | 'follow_up_questions';
export type CopilotAvailability = 'ready' | 'limited' | 'unavailable';
export type CopilotCommandName =
  | 'investigate'
  | 'summarize'
  | 'plan'
  | 'check'
  | 'compare'
  | 'network'
  | 'history';

export interface CopilotContextProvider {
  npi: string;
  label: string | null;
  specialty?: string | null;
  state?: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence?: number | null;
  summary?: string | null;
  activeFindings?: number | null;
}

export interface CopilotEvidenceContextItem {
  source: string;
  claim: string;
  confidence: number;
  observedAt?: string | null;
  field?: string;
  provenanceChain?: string[];
  qualityRating?: 'STRONG' | 'ADEQUATE' | 'WEAK' | 'MISSING';
  corroborationCount?: number;
}

export interface CopilotContextFinding {
  id: string;
  findingType: string;
  title: string;
  severity: string;
  status: string;
  summary: string;
  explanation: string;
  confidence: number;
  priorityScore: number;
  evidence: CopilotEvidenceContextItem[];
  storylineId?: string | null;
  storylineTitle?: string | null;
  providerNpi?: string | null;
  npis: string[];
}

export interface CopilotContextStoryline {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  narrative?: string | null;
  summary?: string | null;
  whyItMatters: string;
  confidence: number;
  findingCount?: number | null;
  entityCount?: number | null;
  progressionScore?: number | null;
  evidence: CopilotEvidenceContextItem[];
  providerNpi?: string | null;
  recommendedActions: string[];
  lastActivityAt?: string | null;
}

export interface CopilotContextGraph {
  focusNodeId: string | null;
  selectedNodeId: string | null;
  neighborNodeIds: string[];
  neighborEdgeIds: string[];
}

export interface CopilotRecentFinding {
  id: string;
  title: string;
  severity?: string | null;
  summary: string;
  priorityScore?: number | null;
  href?: string | null;
}

export interface CopilotEvidenceSummaryItem {
  label: string;
  detail: string;
  source: string;
  observedAt?: string | null;
}

export interface CopilotRiskSummary {
  trustScore?: number | null;
  trustBand?: string | null;
  trustConfidence?: number | null;
  summary?: string | null;
}

export interface CopilotContextPayload {
  scope: CopilotScope;
  provider?: CopilotContextProvider | null;
  finding?: CopilotContextFinding | null;
  storyline?: CopilotContextStoryline | null;
  graph?: CopilotContextGraph | null;
  recentFindings: CopilotRecentFinding[];
  evidenceSummary: CopilotEvidenceSummaryItem[];
  evidenceSummaryStats: TrustSignalSummary | null;
  riskSummary: CopilotRiskSummary | null;
}

export interface CopilotCommandPayload {
  name: CopilotCommandName;
  argument?: string | null;
}

export interface CopilotEntityRef {
  id: string;
  kind: 'provider' | 'finding' | 'storyline' | 'graph-node' | 'institution' | 'company' | 'publication' | 'trial' | 'source';
  label: string;
  value: string;
}

export interface CopilotCitationRef {
  id: string;
  label: string;
  findingId?: string | null;
  evidenceIndex?: number | null;
}

export interface CopilotGraphAction {
  kind: 'focus-node' | 'highlight-neighborhood' | 'navigate-provider';
  nodeId?: string | null;
  npi?: string | null;
}

export interface CopilotDocumentItem {
  id: string;
  label: string;
  detail?: string | null;
  availability?: CopilotAvailability;
  entities?: CopilotEntityRef[];
  citations?: CopilotCitationRef[];
  graphAction?: CopilotGraphAction | null;
}

export interface CopilotDocumentSection {
  id: CopilotSectionId;
  title: string;
  availability?: CopilotAvailability;
  summary?: string | null;
  items: CopilotDocumentItem[];
  collapsedByDefault?: boolean;
}

export interface CopilotDocument {
  mode: CopilotMode;
  sections: CopilotDocumentSection[];
}

export interface CopilotQueryResult {
  id?: string;
  title?: string;
  summary?: string;
  subtitle?: string;
  rank?: number;
  type?: string;
  trustScore?: number;
  trustBand?: string;
  sourceCoverage?: string[];
}

export interface CopilotExplanation {
  resultId?: string;
  title?: string;
  summary?: string;
  because?: string[];
}

export interface CopilotGraphInsight {
  resultId?: string;
  summary?: string;
  type?: string;
  path?: string[];
}

export interface CopilotQuerySuccessPayload {
  status: 'ok';
  parsedQuery?: unknown;
  results?: CopilotQueryResult[];
  explanations?: CopilotExplanation[];
  graphInsights?: CopilotGraphInsight[];
  suggestions?: string[];
  document?: CopilotDocument | ServerCopilotDocument | null;
}

export interface CopilotQueryLimitedPayload {
  status: 'limited';
  title: string;
  message: string;
  suggestions: string[];
  document?: CopilotDocument | ServerCopilotDocument | null;
  parsedQuery?: unknown;
  results?: CopilotQueryResult[];
  explanations?: CopilotExplanation[];
  graphInsights?: CopilotGraphInsight[];
}

export type CopilotQueryPayload = CopilotQuerySuccessPayload | CopilotQueryLimitedPayload;

export interface CopilotPlanPayload {
  schema?: string;
  generatedAt?: string;
  objective: string;
  keyQuestions: string[];
  signalChecks: Array<{
    investigatorId: string;
    findingCount: number;
    lastObservedAt: string | null;
    confidence: number;
    summary: string;
  }>;
  evidenceSummary: Array<{
    label: string;
    detail: string;
    source: string;
    observedAt: string;
  }>;
  networkContext: {
    focusNodeId: string | null;
    highlights: string[];
    topPaths: Array<{
      pathId: string;
      nodeIds: string[];
      edgeIds: string[];
      relationshipTypes: string[];
      score: number;
      explanation: string;
    }>;
  };
  confidenceAssessment: {
    score: number;
    level: 'low' | 'medium' | 'high';
    reasoning: string[];
  };
  recommendedAction: string;
  followUpQueries: string[];
}

export interface CopilotSessionAction {
  id: string;
  label: string;
  kind: 'approve-plan' | 'reuse-prompt';
  prompt?: string;
}

export interface CopilotSessionEntry {
  id: string;
  createdAt: string;
  query: string;
  status: CopilotStatus;
  title: string;
  message?: string | null;
  mode: CopilotMode;
  suggestions: string[];
  document: CopilotDocument;
  actions?: CopilotSessionAction[];
  meta?: {
    source?: string;
  };
}

export interface CopilotHistoryEvent {
  id: string;
  createdAt: string;
  label: string;
  detail?: string | null;
}
