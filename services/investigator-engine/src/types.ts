export type InvestigatorSourceId =
  | 'LEIE'
  | 'NPPES'
  | 'CLINICAL_TRIALS'
  | 'OPENALEX'
  | 'SEMANTIC_SCHOLAR'
  | 'NIH_REPORTER'
  | 'OPEN_PAYMENTS'
  | 'NPDB'
  | 'MONTHLY_DIFF';

export type InvestigatorCadence = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export type InvestigatorSignalType =
  | 'exclusion'
  | 'trial'
  | 'publication'
  | 'grant'
  | 'payment'
  | 'credential'
  | 'network'
  | 'practice';

export type InvestigatorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type StorylineAnchorType = 'entity' | 'event' | 'trend';

export interface InvestigatorEvidenceItem {
  sourceId: InvestigatorSourceId;
  label: string;
  snippet: string | null;
  observedAt: string;
  url?: string | null;
  recordId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NormalizedInvestigatorSignal {
  sourceId: InvestigatorSourceId;
  providerId: string;
  signalType: InvestigatorSignalType;
  detectedAt: string;
  summary: string;
  evidence: InvestigatorEvidenceItem[];
  sourceConfidence: number;
  sourceRecordId?: string | null;
  magnitude?: number | null;
  corroborationSourceIds?: string[];
  providerLabel?: string | null;
  providerSpecialty?: string | null;
  providerState?: string | null;
  providerCentrality?: number | null;
  peerOccurrenceRate?: number | null;
  recencyDays?: number | null;
  metadata?: Record<string, unknown>;
  eventAnchor?: {
    type: 'doi' | 'trial' | 'grant' | 'payment' | 'publication' | 'npdb' | 'generic';
    id: string;
    label?: string | null;
  } | null;
  trendAnchor?: {
    id: string;
    label: string;
    cohortSize?: number | null;
  } | null;
}

export interface NoveltyScoreBreakdown {
  firstOccurrence: number;
  magnitude: number;
  rarityAmongPeers: number;
  recency: number;
  corroboration: number;
}

export interface NoveltyScoreResult {
  score: number;
  normalizedScore: number;
  breakdown: NoveltyScoreBreakdown;
}

export interface PriorityScoreBreakdown {
  severity: number;
  providerCentrality: number;
  novelty: number;
  sourceConfidence: number;
  corroboration: number;
}

export interface PriorityScoreResult {
  score: number;
  normalizedScore: number;
  breakdown: PriorityScoreBreakdown;
}

export interface EngineFinding {
  providerId: string;
  signalType: InvestigatorSignalType;
  severity: InvestigatorSeverity;
  confidence: number;
  summary: string;
  evidence: InvestigatorEvidenceItem[];
  timestamp: string;
  title: string;
  explanation: string;
  novelty: NoveltyScoreResult;
  priority: PriorityScoreResult;
  storylineKey: string;
  storylineAnchorType: StorylineAnchorType;
  dedupeKey: string;
  metadata: Record<string, unknown>;
}

export interface StorylineFindingSummary {
  title: string;
  summary: string;
  signalType: InvestigatorSignalType;
  severity: InvestigatorSeverity;
  timestamp: string;
}

export interface StorylineNarrative {
  headline: string;
  providerContext: string;
  findings: string[];
  networkContext: string;
  recommendedAction: string;
  narrative: string;
}

export interface EngineStoryline {
  storylineKey: string;
  anchorType: StorylineAnchorType;
  title: string;
  summary: string;
  severity: InvestigatorSeverity;
  providerIds: string[];
  signalTypes: InvestigatorSignalType[];
  findings: StorylineFindingSummary[];
  narrative: StorylineNarrative;
  metadata: Record<string, unknown>;
}

export interface ScheduleJobDefinition {
  id: string;
  cadence: InvestigatorCadence;
  sources: InvestigatorSourceId[];
  description: string;
}

export interface ScheduleDueInput {
  lastRunAt?: string | null;
  now?: string;
}

