export type CopilotAvailability = 'ready' | 'limited' | 'unavailable';
export type CopilotDocumentMode = 'summary' | 'plan' | 'check' | 'compare' | 'network' | 'history';
export type CopilotCommandName = 'investigate' | 'summarize' | 'plan' | 'check' | 'compare' | 'network' | 'history';
export type CopilotEntityKind =
  | 'provider'
  | 'finding'
  | 'storyline'
  | 'institution'
  | 'company'
  | 'trial'
  | 'publication'
  | 'graph_node'
  | 'source';
export type CopilotGraphActionType = 'focus_node' | 'highlight_neighborhood' | 'navigate_provider';
export type CopilotPlanPhase = 'draft' | 'approved' | 'running' | 'completed';
export type CopilotCheckKind = 'verification' | 'oig' | 'network';

export interface CopilotProviderContext {
  npi: string;
  label: string | null;
  specialty?: string | null;
  state?: string | null;
  trustScore: number;
  trustBand: string;
  trustConfidence?: number;
  activeFindings?: number;
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

export interface CopilotFindingContext {
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
  npis: string[];
}

export interface CopilotStorylineContext {
  id: string;
  title: string;
  storylineType: string;
  severity: string;
  status: string;
  narrative?: string;
  whyItMatters: string;
  findingCount?: number;
  entityCount?: number;
  confidence: number;
  progressionScore?: number;
  recommendedActions: string[];
  lastActivityAt?: string;
  evidence: CopilotEvidenceContextItem[];
}

export interface CopilotRecentFinding {
  id: string;
  title: string;
  summary: string;
  severity: string;
  priorityScore?: number;
  href?: string;
}

export interface CopilotEvidenceSummaryItem {
  label: string;
  detail: string;
  source: string;
  observedAt?: string | null;
}

export interface CopilotRiskSummary {
  trustScore?: number;
  trustBand?: string;
  trustConfidence?: number;
  summary?: string;
}

export interface CopilotGraphContext {
  focusNodeId?: string | null;
  selectedNodeId?: string | null;
  neighborNodeIds: string[];
  neighborEdgeIds: string[];
}

export interface CopilotContextPayload {
  scope: 'provider' | 'finding' | 'storyline' | 'graph' | 'global';
  provider?: CopilotProviderContext;
  finding?: CopilotFindingContext;
  storyline?: CopilotStorylineContext;
  graph?: CopilotGraphContext;
  recentFindings: CopilotRecentFinding[];
  evidenceSummary: CopilotEvidenceSummaryItem[];
  riskSummary?: CopilotRiskSummary;
}

export interface CopilotCommandPayload {
  name: CopilotCommandName;
  argument?: string;
  raw?: string;
}

export interface CopilotDocumentEntity {
  id: string;
  kind: CopilotEntityKind;
  label: string;
  providerNpi?: string;
  findingId?: string;
  storylineId?: string;
  nodeId?: string;
}

export interface CopilotDocumentCitation {
  id: string;
  label: string;
  source?: string;
  findingId?: string;
  evidenceIndex?: number;
}

export interface CopilotDocumentGraphAction {
  type: CopilotGraphActionType;
  label: string;
  nodeId?: string;
  providerNpi?: string;
}

export interface CopilotDocumentSectionItem {
  id: string;
  title?: string;
  body: string;
  availability?: CopilotAvailability;
  entities?: CopilotDocumentEntity[];
  citations?: CopilotDocumentCitation[];
  graphAction?: CopilotDocumentGraphAction;
}

export interface CopilotDocumentSection {
  key: 'summary' | 'evidence' | 'signals' | 'network_context' | 'recommended_action' | 'follow_up_questions';
  title: string;
  availability: CopilotAvailability;
  summary?: string;
  items: CopilotDocumentSectionItem[];
}

export interface CopilotDocument {
  mode: CopilotDocumentMode;
  title: string;
  subtitle?: string;
  generatedAt?: string;
  suggestions: string[];
  sections: CopilotDocumentSection[];
}

export interface CopilotQueryResult {
  id: string;
  rank: number;
  type: string;
  title: string;
  subtitle?: string;
  summary: string;
  specialty?: string;
  state?: string;
  institution?: string;
  licenseStatus?: string;
  boardCertified?: boolean;
  trustScore?: number;
  trustBand?: string;
  scores: {
    relevance: number;
    trustScore: number;
    freshness: number;
    sourceCoverage: number;
    total: number;
  };
  sourceCoverage: string[];
}

export interface CopilotExplanation {
  resultId: string;
  title: string;
  summary: string;
  because: string[];
  matchedFilters: Array<{
    field: string;
    value: string | number | boolean;
    reason: string;
  }>;
  verifiedSources: string[];
  scoring: CopilotQueryResult['scores'];
}

export interface CopilotGraphInsight {
  resultId?: string;
  type: string;
  summary: string;
  path: string[];
  depth: number;
}

export interface CopilotQueryOkResponsePayload {
  status: 'ok';
  answer: string;
  sources: string[];
  confidence: number;
  parsedQuery: unknown;
  results: CopilotQueryResult[];
  explanations: CopilotExplanation[];
  graphInsights: CopilotGraphInsight[];
  document: CopilotDocument;
}

export interface CopilotQueryLimitedResponsePayload {
  status: 'limited';
  title: string;
  message: string;
  suggestions: string[];
  answer: string;
  sources: string[];
  confidence: number;
  parsedQuery?: unknown;
  results: CopilotQueryResult[];
  explanations: CopilotExplanation[];
  graphInsights: CopilotGraphInsight[];
  document: CopilotDocument;
}

export type CopilotQueryResponsePayload =
  | CopilotQueryOkResponsePayload
  | CopilotQueryLimitedResponsePayload;

export interface CopilotAskResponsePayload {
  answer: string;
  intent: string;
  confidence: number;
  suggestions: string[];
  sources: string[];
  timing: number;
  data: {
    results: CopilotQueryResult[];
    graphInsights: CopilotGraphInsight[];
    document?: CopilotDocument;
    status?: 'ok' | 'limited';
  };
}

export interface CopilotSessionEvent {
  id: string;
  type:
    | 'query_submitted'
    | 'response_received'
    | 'limited_response'
    | 'plan_created'
    | 'plan_approved'
    | 'plan_running'
    | 'plan_completed'
    | 'check_started'
    | 'check_completed'
    | 'check_limited';
  title: string;
  detail: string;
  createdAt: string;
}

export interface CopilotPlanCheck {
  id: string;
  label: string;
  kind: CopilotCheckKind;
  detail: string;
  status: 'pending' | 'running' | 'completed' | 'limited';
}

export interface CopilotPlanState {
  phase: CopilotPlanPhase;
  objective: string;
  providerId?: string;
  storylineId?: string;
  findingId?: string;
  checks: CopilotPlanCheck[];
}

export interface CopilotSessionEntry {
  id: string;
  query: string;
  status: 'ok' | 'limited' | 'running';
  title: string;
  subtitle?: string;
  createdAt: string;
  document: CopilotDocument;
  suggestions: string[];
  plan?: CopilotPlanState;
}

export function isCopilotLimitedResponse(
  payload: CopilotQueryResponsePayload,
): payload is CopilotQueryLimitedResponsePayload {
  return payload.status === 'limited';
}
