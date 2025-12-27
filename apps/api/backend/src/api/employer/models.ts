export type ReadinessStatus = 'READY' | 'ALMOST_READY' | 'NOT_READY';

export type RequirementStatus = 'MET' | 'PARTIAL' | 'NOT_MET';

export interface RequirementEvidence {
  requirementId: string;
  label: string;
  status: RequirementStatus;
  evidence: string[];
  gaps: string[];
  remediation?: string;
}

export interface EmployerReadinessSummary {
  clinicianId: string;
  jobId: string;
  jobTitle?: string;
  status: ReadinessStatus;
  generatedAt: string;
  rationale: string[];
  requirements: RequirementEvidence[];
  auditRef?: string;
}
