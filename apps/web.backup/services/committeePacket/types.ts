import type { Logger } from '@chai-vc/logging-core';

export type SeverityLevel = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type RiskTier = 'low' | 'moderate' | 'high' | 'critical';

export interface ClinicianProfile {
  id: string;
  name: string;
  specialty?: string;
  department?: string;
  facility?: string;
  npi?: string;
}

export interface CommitteeCycle {
  packetId: string;
  meetingDate?: string;
  coveragePeriod?: {
    start: string;
    end: string;
  };
  renewalDueDate?: string;
}

export interface DriftEvent {
  id: string;
  label: string;
  category: 'data' | 'credential' | 'quality' | 'payer';
  severity: SeverityLevel;
  description: string;
  detectedAt: string;
  resolved?: boolean;
  relatedItemId?: string;
}

export interface ComplianceItem {
  id: string;
  label: string;
  type: 'LICENSE' | 'BOARD' | 'DEA' | 'PSV' | 'TRAINING' | 'OTHER';
  jurisdiction?: string;
  status: 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'SUSPENDED' | 'MISSING' | 'IN_PROGRESS';
  expiresAt?: string;
  lastVerifiedAt?: string;
  source?: string;
  notes?: string;
  severity?: SeverityLevel;
}

export interface RiskSignal {
  id: string;
  label: string;
  severity: SeverityLevel;
  description: string;
  detectedAt?: string;
  resolved?: boolean;
  source: 'drift' | 'quality' | 'licensure' | 'payer' | 'fraud' | 'ops';
}

export interface RiskProfile {
  score: number;
  tier?: RiskTier;
  monitoringLevel?: 'baseline' | 'elevated' | 'restricted';
  lastEvaluatedAt?: string;
  signals: RiskSignal[];
  driftEvents?: DriftEvent[];
  expiredItems?: ComplianceItem[];
}

export interface QualityTrendPoint {
  period: string;
  score: number;
  label?: string;
  status?: 'green' | 'yellow' | 'red';
  change?: number;
  volume?: number;
}

export interface ProcedureVolumeBreakdown {
  name: string;
  count: number;
  target?: number;
  change?: number;
}

export interface ProcedureVolumeSummary {
  totalProcedures: number;
  requiredMinimum?: number;
  trend?: number;
  period?: string;
  breakdown?: ProcedureVolumeBreakdown[];
}

export interface FPPEStatus {
  status: 'NOT_REQUIRED' | 'REQUIRED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  lastReviewAt?: string;
  reviewer?: string;
  notes?: string;
}

export interface SentinelEvent {
  id: string;
  description: string;
  severity: SeverityLevel;
  occurredAt: string;
  resolvedAt?: string;
  status: 'OPEN' | 'CLOSED';
}

export interface QualityProfile {
  oppe?: {
    compositeScore?: number;
    trend?: QualityTrendPoint[];
    alerts?: string[];
  };
  fppe?: FPPEStatus;
  procedureVolume?: ProcedureVolumeSummary;
  sentinelEvents?: SentinelEvent[];
  improvementPlans?: Array<{
    id: string;
    title: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
    dueDate?: string;
    severity?: SeverityLevel;
  }>;
}

export interface LicensureBoardProfile {
  licenses: ComplianceItem[];
  boardCertifications: ComplianceItem[];
  investigations?: Array<{
    id: string;
    description: string;
    severity: SeverityLevel;
    status: 'OPEN' | 'CLOSED';
    openedAt?: string;
    closedAt?: string;
  }>;
  driftEvents?: DriftEvent[];
}

export interface PayerEnrollmentStatus {
  payerId: string;
  payerName: string;
  program: string;
  status: 'ACTIVE' | 'PENDING' | 'TERMINATED' | 'REQUESTED' | 'BLOCKED';
  effectiveDate?: string;
  expirationDate?: string;
  pecosAligned?: boolean;
  medicaidAligned?: boolean;
  panelStatus?: 'OPEN' | 'CLOSED' | 'FULL' | 'LIMITED';
  panelNotes?: string;
  lastUpdated?: string;
  issues?: string[];
  severity?: SeverityLevel;
}

export interface PanelIssue {
  id: string;
  description: string;
  severity: SeverityLevel;
  payerName?: string;
  openedAt?: string;
  dueAt?: string;
  status: 'OPEN' | 'CLOSED' | 'ESCALATED';
}

export interface PayerProfile {
  enrollments: PayerEnrollmentStatus[];
  panelIssues?: PanelIssue[];
  gaps?: string[];
  pecosSummary?: string;
  medicaidSummary?: string;
}

export interface CommitteePacketData {
  clinician: ClinicianProfile;
  cycle: CommitteeCycle;
  risk?: RiskProfile;
  quality?: QualityProfile;
  licensure?: LicensureBoardProfile;
  payer?: PayerProfile;
  context?: Record<string, unknown>;
}

export interface EvidencePoint {
  id: string;
  label: string;
  severity: SeverityLevel;
  detail?: string;
  observedAt?: string;
  sectionRef?: string;
  resolved?: boolean;
}

export interface SectionNarrative {
  section: 'risk' | 'quality' | 'licensure' | 'payer' | 'overview';
  summary: string;
  highlights: string[];
  concerns: string[];
  evidence: EvidencePoint[];
  confidence: 'low' | 'medium' | 'high';
}

export interface ExplainSectionOptions {
  deterministic?: boolean;
  highlightLimit?: number;
  clock?: () => Date;
  logger?: Logger;
}

export interface NarrativeModelInput {
  prompt: string;
  context: Record<string, unknown>;
}

export interface NarrativeModelClient {
  name: string;
  deterministic?: boolean;
  complete(input: NarrativeModelInput): Promise<string>;
}

export interface NarrativeEngineOptions extends ExplainSectionOptions {
  llmClient?: NarrativeModelClient;
  includePrompt?: boolean;
}

export interface CommitteeNarrativeSections {
  risk: SectionNarrative;
  quality: SectionNarrative;
  licensure: SectionNarrative;
  payer: SectionNarrative;
}

export interface CommitteeNarrative {
  overview: string;
  highlights: string[];
  concerns: string[];
  recommendation: string;
  sections: CommitteeNarrativeSections;
  metadata: {
    deterministic: boolean;
    generatedAt: string;
    clinicianId: string;
    highlightLimit: number;
    promptHash: string;
    llmModel?: string;
  };
  prompt?: string;
  llmDraft?: string;
}


