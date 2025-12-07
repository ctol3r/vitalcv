export type FusionSeverity = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

export type FusionSignalSource = 'QUALITY' | 'CREDENTIAL' | 'COMPLIANCE';

export enum QualitySignalType {
  OPPE_FAILURE = 'OPPE_FAILURE',
  FPPE_ESCALATION = 'FPPE_ESCALATION',
  COMPLICATION_SPIKE = 'COMPLICATION_SPIKE',
  PAYER_DENIAL_SPIKE = 'PAYER_DENIAL_SPIKE',
  QUALITY_HOLD = 'QUALITY_HOLD',
  PATIENT_COMPLAINT_SPIKE = 'PATIENT_COMPLAINT_SPIKE',
}

export enum CredentialSignalType {
  BOARD_STATUS_DRIFT = 'BOARD_STATUS_DRIFT',
  LICENSE_DRIFT = 'LICENSE_DRIFT',
  PECOS_CONFLICT = 'PECOS_CONFLICT',
  SANCTION_ACTIVITY = 'SANCTION_ACTIVITY',
  PRIVILEGE_GAP = 'PRIVILEGE_GAP',
}

export interface FusionSignalInput {
  id?: string;
  label?: string;
  type: string;
  severity?: FusionSeverity;
  source?: FusionSignalSource;
  weight?: number;
  description?: string;
  occurredAt?: Date | string | null;
  metadata?: Record<string, unknown> | null;
  recommendedActions?: string[];
}

export interface FusionSignal {
  id: string;
  label: string;
  type: string;
  severity: FusionSeverity;
  source: FusionSignalSource;
  weight: number;
  description?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown> | null;
  recommendedActions?: string[];
}

export interface ComplianceFindingInput {
  id?: string;
  label: string;
  severity?: FusionSeverity;
  framework?: string;
  description?: string;
  occurredAt?: Date | string | null;
}

export interface ComplianceFinding {
  id: string;
  label: string;
  severity: FusionSeverity;
  framework?: string;
  description?: string;
  occurredAt?: string;
}

export interface FusionRuleMatch {
  id: string;
  label: string;
  severity: FusionSeverity;
  impact: number;
  matchedSignals: string[];
  description: string;
  recommendedActions: string[];
}

export interface FusionScoreBreakdown {
  qualityScore: number;
  credentialScore: number;
  complianceScore: number;
  ruleScore: number;
  baselineContribution: number;
}

export interface FusionEngineInput {
  clinicianId: string;
  qualitySignals?: FusionSignalInput[];
  credentialSignals?: FusionSignalInput[];
  credentialRiskFactors?: string[];
  complianceFindings?: ComplianceFindingInput[];
  baselineRiskScore?: number;
  asOf?: Date;
}

export interface FusionEngineResult {
  clinicianId: string;
  compositeScore: number;
  contributingQualitySignals: FusionSignal[];
  contributingCredentialSignals: FusionSignal[];
  complianceFindings: ComplianceFinding[];
  recommendedActions: string[];
  ruleMatches: FusionRuleMatch[];
  breakdown: FusionScoreBreakdown;
  timestamp: Date;
}


