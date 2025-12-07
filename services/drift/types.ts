export type DriftCategory = 'privilege' | 'payer' | 'access' | 'identity';

export type DriftSeverity = 'info' | 'warning' | 'critical';

export type DriftSignalType =
  | 'PRIVILEGE_EXPIRED'
  | 'PRIVILEGE_FPPE_FAILED'
  | 'PRIVILEGE_RENEWAL_OVERDUE'
  | 'PAYER_REVALIDATION_DUE'
  | 'PAYER_STATUS_MISMATCH'
  | 'ACCESS_ROLE_DRIFT';

export interface DriftSignalTargets {
  privilegeGrantedId?: string;
  payerEnrollmentId?: string;
  orgId?: string;
}

export interface DriftDetection {
  detectorId: string;
  type: DriftSignalType;
  category: DriftCategory;
  severity: DriftSeverity;
  clinicianId?: string;
  clinicianDid?: string;
  orgId?: string;
  summary: string;
  recommendation?: string;
  payload?: Record<string, unknown>;
  targets?: DriftSignalTargets;
  fingerprint?: string;
}

export interface DriftResolutionPayload {
  resolutionType: string;
  notes?: string;
}
import type { TimelineEvent } from '../timeline/types';

export type DriftCategory =
  | 'licensure'
  | 'board'
  | 'dea'
  | 'directory'
  | 'pecos'
  | 'medicaid';

export type DriftSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface DriftEvidence {
  field: string;
  before?: unknown;
  after?: unknown;
  detail?: string;
  source?: string;
}

export interface DriftAffectedEntity {
  type: 'clinician' | 'license' | 'board_cert' | 'dea' | 'directory' | 'enrollment';
  id: string;
  label?: string;
}

export interface DriftEvent {
  id: string;
  detector: string;
  category: DriftCategory;
  severity: DriftSeverity;
  title: string;
  summary: string;
  detectedAt: Date;
  dimension?: string;
  subject?: DriftAffectedEntity;
  evidence?: DriftEvidence[];
  metadata?: Record<string, unknown>;
  recommendations?: string[];
}

export interface DriftRiskImpact {
  code: string;
  severity: DriftSeverity;
  description: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface DriftDetectionStats {
  totalSignals: number;
  severityBreakdown: Partial<Record<DriftSeverity, number>>;
}

export interface DriftDetectionResult<TEvent extends DriftEvent = DriftEvent> {
  events: TEvent[];
  timelineEvents?: TimelineEvent[];
  riskImpacts?: DriftRiskImpact[];
  stats?: DriftDetectionStats;
}

export interface DriftDetector<TInput, TEvent extends DriftEvent = DriftEvent> {
  readonly id: string;
  readonly category: DriftCategory;
  detect(input: TInput): DriftDetectionResult<TEvent>;
}

export interface LocationSnapshot {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
