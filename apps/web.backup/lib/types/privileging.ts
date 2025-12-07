/**
 * Privileging System Type Definitions
 * Central type definitions for the privileging system
 */

// ============================================================================
// PRIVILEGE SETS
// ============================================================================

export interface PrivilegeSet {
  id: string;
  name: string;
  department: string;
  specialty?: string;
  description?: string;
  procedureCount: number;
  procedures: Procedure[];
  status: PrivilegeSetStatus;
  minimumCaseVolume?: string;
  yearsExperienceRequired?: string;
  boardCertificationRequired?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

export type PrivilegeSetStatus = "active" | "draft" | "archived";

export interface Procedure {
  id: string;
  name: string;
  code?: string;
}

export interface CreatePrivilegeSetRequest {
  name: string;
  department: string;
  specialty?: string;
  description?: string;
  procedures: Omit<Procedure, "id">[];
  minimumCaseVolume?: string;
  yearsExperienceRequired?: string;
  boardCertificationRequired?: boolean;
}

// ============================================================================
// PRIVILEGE REQUESTS
// ============================================================================

export interface PrivilegeRequest {
  id: string;
  clinicianId: string;
  clinicianName: string;
  clinicianNPI: string;
  privilegeSetId: string;
  privilegeSetName: string;
  department: string;
  status: PrivilegeRequestStatus;
  requestDate: string;
  reviewedDate?: string;
  reviewerName?: string;
  reviewerId?: string;
  reviewNotes?: string;
  verifiableCredential: VerifiableCredential;
  passReasons: string[];
  failReasons: string[];
}

export type PrivilegeRequestStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "denied";

export interface VerifiableCredential {
  "@context": string[];
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: CredentialSubject;
  proof?: any;
}

export interface CredentialSubject {
  id: string;
  name: string;
  npi: string;
  licenseNumber?: string;
  licenseState?: string;
  specialty?: string;
  boardCertification?: string[];
  yearsExperience?: number;
  procedures?: ProcedureEvidence[];
  [key: string]: any;
}

export interface ProcedureEvidence {
  name: string;
  caseCount?: number;
  lastPerformed?: string;
}

export interface ApproveRequestBody {
  notes?: string;
}

export interface DenyRequestBody {
  notes: string;
  reason: string;
}

// ============================================================================
// PRIVILEGES (Granted)
// ============================================================================

export interface Privilege {
  id: string;
  clinicianId: string;
  clinicianName: string;
  privilegeSetId: string;
  privilegeSetName: string;
  specialty: string;
  procedures: string[];
  grantedDate: string;
  lastReviewDate?: string;
  nextReviewDate?: string;
  status: PrivilegeStatus;
  reviewer?: string;
  conditions?: string[];
}

export type PrivilegeStatus =
  | "active"
  | "pending"
  | "expired"
  | "suspended"
  | "revoked";

// ============================================================================
// FPPE/OPPE EVALUATIONS
// ============================================================================

export interface OppeRecord {
  id: string;
  clinicianId: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  evaluationType: EvaluationType;
  privilegeId: string;
  privilegeSetName: string;
  startDate: string;
  dueDate: string;
  completedDate?: string;
  lastEvaluationDate?: string;
  status: OppeStatus;
  assignedReviewerId?: string;
  assignedReviewer?: string;
}

export type EvaluationType = "FPPE" | "OPPE";

export type OppeStatus =
  | "upcoming"
  | "due_soon"
  | "overdue"
  | "in_progress"
  | "completed";

// FPPE Evaluation
export interface FppeEvaluation {
  id: string;
  recordId: string;
  clinicianId: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  privilegeSetName: string;
  startDate: string;
  dueDate: string;
  completedDate?: string;
  status: "pending" | "in_progress" | "completed";
  checklistItems: ChecklistItem[];
  overallRecommendation?: FppeRecommendation;
  summaryComments?: string;
  reviewerId?: string;
  reviewerName?: string;
}

export interface ChecklistItem {
  id: string;
  category: string;
  criterion: string;
  result?: ChecklistResult;
  comments?: string;
}

export type ChecklistResult = "pass" | "fail" | "not_applicable";

export type FppeRecommendation = "approve" | "conditional" | "deny";

export interface SubmitFppeEvaluationRequest {
  checklistItems: ChecklistItem[];
  overallRecommendation: FppeRecommendation;
  summaryComments: string;
}

// OPPE Evaluation
export interface OppeEvaluation {
  id: string;
  recordId: string;
  clinicianId: string;
  clinicianName: string;
  clinicianNPI: string;
  department: string;
  privilegeSetName: string;
  evaluationPeriod: string;
  startDate: string;
  dueDate: string;
  completedDate?: string;
  status: "pending" | "in_progress" | "completed";
  metrics: MetricItem[];
  overallAssessment?: OppeAssessment;
  summaryComments?: string;
  reviewerId?: string;
  reviewerName?: string;
}

export interface MetricItem {
  id: string;
  category: string;
  metric: string;
  description: string;
  rating?: MetricRating;
  comments?: string;
}

export type MetricRating =
  | "excellent"
  | "satisfactory"
  | "needs_improvement"
  | "unsatisfactory";

export type OppeAssessment = "pass" | "fail";

export interface SubmitOppeEvaluationRequest {
  metrics: MetricItem[];
  overallAssessment: OppeAssessment;
  summaryComments: string;
  status?: "in_progress" | "completed";
}

// ============================================================================
// API RESPONSES
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ListPrivilegeSetsResponse extends ApiResponse<PrivilegeSet[]> {}
export interface GetPrivilegeSetResponse extends ApiResponse<PrivilegeSet> {}
export interface CreatePrivilegeSetResponse extends ApiResponse<PrivilegeSet> {}

export interface ListPrivilegeRequestsResponse extends ApiResponse<PrivilegeRequest[]> {}
export interface GetPrivilegeRequestResponse extends ApiResponse<PrivilegeRequest> {}

export interface ListOppeRecordsResponse extends ApiResponse<OppeRecord[]> {}
export interface GetFppeEvaluationResponse extends ApiResponse<FppeEvaluation> {}
export interface GetOppeEvaluationResponse extends ApiResponse<OppeEvaluation> {}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

export interface ListPrivilegeSetsParams {
  status?: PrivilegeSetStatus;
  department?: string;
  search?: string;
}

export interface ListPrivilegeRequestsParams {
  status?: PrivilegeRequestStatus;
  department?: string;
  search?: string;
}

export interface ListOppeRecordsParams {
  type?: EvaluationType;
  status?: OppeStatus;
  department?: string;
  search?: string;
}

