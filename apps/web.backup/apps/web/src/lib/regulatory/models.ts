/**
 * Regulatory Portal - Models
 * Types and interfaces for regulatory compliance data
 */

export interface RegulatoryPortalState {
  loading: boolean;
  ready: RegulatoryBundle | null;
  error: string | null;
}

export interface RegulatoryBundle {
  clinicianId: string;
  npi: string;
  did: string;
  trustScore: number;
  chainAnchors: ChainAnchorSummary;
  stateBoards: StateBoardLicense[];
  dea: DEAStatus | null;
  cms: CMSPECOSStatus | null;
  payers: PayerEnrollment[];
  lastUpdated: string;
}

export interface ChainAnchorSummary {
  total: number;
  valid: number;
  stale: number;
  lastAnchorDate: string;
  regulatoryDocuments: RegulatoryDocumentAnchor[];
}

export interface RegulatoryDocumentAnchor {
  documentId: string;
  documentType: 'license' | 'dea' | 'board_cert' | 'cms' | 'payer';
  anchorHash: string;
  anchorDate: string;
  chainStatus: 'valid' | 'stale' | 'missing';
}

// State Board Types
export interface StateBoardLicense {
  id: string;
  state: string;
  stateCode: string;
  licenseNumber: string;
  status: 'active' | 'expired' | 'pending' | 'suspended' | 'revoked';
  expirationDate: string;
  issueDate: string;
  compactEligible: boolean;
  compactStatus: 'eligible' | 'active' | 'ineligible' | 'pending';
  reVerificationCycle: number; // days
  evidenceRequirements: EvidenceRequirement[];
  missingDocuments: string[];
  sanctions: BoardSanction[];
  disciplineHistory: DisciplineRecord[];
  chainAnchor: RegulatoryDocumentAnchor | null;
}

export interface EvidenceRequirement {
  type: string;
  description: string;
  required: boolean;
  provided: boolean;
  documentId: string | null;
}

export interface BoardSanction {
  id: string;
  type: 'warning' | 'fine' | 'suspension' | 'revocation';
  date: string;
  description: string;
  resolved: boolean;
}

export interface DisciplineRecord {
  id: string;
  date: string;
  action: string;
  description: string;
  status: 'active' | 'resolved';
}

// DEA Types
export interface DEAStatus {
  deaNumber: string;
  schedules: string[]; // e.g., ['II', 'III', 'IV']
  status: 'active' | 'expired' | 'suspended' | 'revoked';
  expirationDate: string;
  issueDate: string;
  mateActCompleted: boolean;
  mateActCompletionDate: string | null;
  mateActCredits: number;
  sanctions: DEASanction[];
  flags: DEAFlag[];
  trustScore: number;
  chainAnchor: RegulatoryDocumentAnchor | null;
}

export interface DEASanction {
  id: string;
  type: string;
  date: string;
  description: string;
  resolved: boolean;
}

export interface DEAFlag {
  id: string;
  type: 'expiration_warning' | 'sanction' | 'compliance_issue';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  date: string;
}

// CMS/PECOS Types
export interface CMSPECOSStatus {
  npi: string;
  pecosEnrollmentStatus: 'enrolled' | 'pending' | 'inactive' | 'terminated';
  pecosEnrollmentDate: string | null;
  providerType: string;
  reassignments: MedicareReassignment[];
  revalidationDue: boolean;
  revalidationDueDate: string | null;
  complianceBadges: CMSComplianceBadge[];
  cms855FormData: CMS855FormData | null;
  chainAnchor: RegulatoryDocumentAnchor | null;
}

export interface MedicareReassignment {
  id: string;
  tin: string;
  tinName: string;
  effectiveDate: string;
  terminationDate: string | null;
  status: 'active' | 'terminated';
}

export interface CMSComplianceBadge {
  type: 'provider_enrollment_verified' | 'group_affiliation_valid' | 'revalidation_required';
  status: 'verified' | 'pending' | 'invalid';
  description: string;
  lastVerified: string;
}

export interface CMS855FormData {
  providerName: string;
  npi: string;
  tin: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  specialty: string;
  practiceType: string;
  // Additional CMS-855 fields
}

// Payer Types
export interface PayerEnrollment {
  id: string;
  payerName: string;
  payerType: 'commercial' | 'medicaid' | 'medicare_advantage';
  state: string;
  enrollmentStatus: 'active' | 'pending' | 'declined' | 'terminated';
  enrollmentDate: string | null;
  requiredDocuments: PayerDocument[];
  providedDocuments: string[];
  missingDocuments: string[];
  applicationPacketId: string | null;
  chainAnchor: RegulatoryDocumentAnchor | null;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface PayerDocument {
  type: string;
  description: string;
  required: boolean;
  provided: boolean;
  documentId: string | null;
}

export interface ApplicationPacket {
  id: string;
  payerId: string;
  createdAt: string;
  documents: string[];
  chainAnchor: RegulatoryDocumentAnchor | null;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
}








