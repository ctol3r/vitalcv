export type WorkflowContext =
  | 'job_application'
  | 'privileging'
  | 'locums'
  | 'share';

export type TrustReadinessLevel = 'L0' | 'L1' | 'L2' | 'L3';
export type TrustReadinessStatus = 'READY' | 'CONDITIONALLY_READY' | 'NOT_READY';
export type ArtifactScore = 0 | 40 | 75 | 100;
export type FreshnessState = 'not_applicable' | 'current' | 'stale' | 'expired';

export type CanonicalArtifactKey =
  | 'identity_binding'
  | 'npi_verification'
  | 'state_license'
  | 'board_certification'
  | 'sanctions_clear'
  | 'dea_registration'
  | 'malpractice_insurance'
  | 'malpractice_history'
  | 'npdb_clear'
  | 'background_check'
  | 'privileging_file'
  | 'telehealth_agreement'
  | 'bls_acls';

export type RequirementWeight = 1 | 2 | 3;

export interface ArtifactStatusEntry {
  canonicalArtifactKey: string;
  requirementLabel: string;
  requirementWeight: RequirementWeight;
  resolvedLevel: TrustReadinessLevel;
  artifactScore: ArtifactScore;
  revoked: boolean;
  freshness: FreshnessState;
  matchedEvidenceIds: string[];
  reasons: string[];
}

export interface TrustStateSnapshotPayload {
  subjectDid: string;
  subjectNpi: string | null;
  contextOrgId: string | null;
  workflowContext: WorkflowContext;
  readinessScore: number;
  readinessLevel: TrustReadinessLevel;
  readinessStatus: TrustReadinessStatus;
  artifactStatuses: ArtifactStatusEntry[];
  warnings: string[];
  methodologyVersion: string;
  generatedAt: string;
}

export interface TrustRequirement {
  canonicalArtifactKey: string;
  requirementLabel: string;
  requirementWeight: RequirementWeight;
  mapped: boolean;
  source: 'workflow_default' | 'organization_requirement';
}

export interface BindingProjection {
  id: string;
  did: string;
  npi: string;
  status: string;
  updatedAt: Date;
  contestReason: string | null;
}

export interface VerificationArtifactRecord {
  id: string;
  npi: string;
  source: string;
  status: string;
  rawPayload: unknown;
  verifiedAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  suspendedAt: Date | null;
  revocationReason: string | null;
  lifecycleState: string;
  statusLastChecked: Date;
  psvWindowStart: Date | null;
  psvWindowDeadline: Date | null;
  psvWindowCompliant: boolean | null;
  organizationId: string | null;
  trustState: string;
  createdAt: Date;
}

export interface CandidateCredentialRecord {
  id: string;
  candidateCredentialId: string;
  clinicianId: string;
  status: string;
  data: unknown;
  createdAt: Date;
}

export interface FreshnessEvaluation {
  freshness: FreshnessState;
  valid: boolean;
  reasons: string[];
}

export interface ArtifactEvaluationContext {
  requirement: TrustRequirement;
  binding: BindingProjection | null;
  verificationArtifacts: readonly VerificationArtifactRecord[];
  candidateCredentials: readonly CandidateCredentialRecord[];
  now: Date;
}

export interface ArtifactEvaluationResult extends ArtifactStatusEntry {
  warnings: string[];
}
