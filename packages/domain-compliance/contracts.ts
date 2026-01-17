type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

export const COMPLIANCE_STATUSES = ['PASS', 'WARN', 'FAIL', 'PENDING'] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const NCQA_RULE_CODES = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'] as const;
export type NCQARuleCode = (typeof NCQA_RULE_CODES)[number];

export interface ComplianceEvidenceReference {
  id: string;
  type: string;
  label?: string;
  uri?: string;
  capturedAt?: string;
  hash?: string;
  metadata?: JsonObject;
}

export interface ComplianceFinding {
  ruleCode: NCQARuleCode;
  status: ComplianceStatus;
  summary: string;
  detail?: string;
  evidence?: ComplianceEvidenceReference[];
  updatedAt: string;
}

export interface ClinicianComplianceSummary {
  clinicianId: string;
  statuses: Record<NCQARuleCode, ComplianceStatus>;
  updatedAt: string;
}

export interface ComplianceSnapshot {
  clinicianId: string;
  findings: ComplianceFinding[];
  overallStatus: ComplianceStatus;
  updatedAt: string;
}
