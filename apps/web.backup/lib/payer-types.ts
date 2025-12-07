/**
 * Payer Enrollment Types and Interfaces
 *
 * Types for managing payer enrollment, credentialing, and revalidation
 * processes for healthcare providers with insurance payers.
 */

/**
 * Payer enrollment status lifecycle
 */
export type PayerEnrollmentStatus =
  | 'draft'           // Initial enrollment started, not submitted
  | 'pending'         // Submitted, awaiting payer review
  | 'in_review'       // Under active review by payer
  | 'approved'        // Enrollment approved, provider can bill
  | 'rejected'        // Enrollment rejected
  | 'suspended'       // Temporarily suspended
  | 'terminated'      // Enrollment terminated
  | 'revalidating';   // Undergoing revalidation

/**
 * Enrollment evidence document types
 */
export type EvidenceType =
  | 'license'         // Medical license
  | 'dea'            // DEA certificate
  | 'board_cert'     // Board certification
  | 'cv'             // Curriculum vitae
  | 'caqh'           // CAQH attestation
  | 'w9'             // Tax form W-9
  | 'coi'            // Certificate of insurance (malpractice)
  | 'other';         // Other supporting documents

/**
 * Product lines or service types with payer
 */
export type ProductLine =
  | 'medical'        // General medical
  | 'behavioral'     // Mental health/behavioral
  | 'telehealth'     // Telemedicine
  | 'urgent_care'    // Urgent care
  | 'specialty'      // Specialty care
  | 'primary_care';  // Primary care

/**
 * Payer/insurance company information
 */
export interface PayerInfo {
  id: string;
  name: string;
  npiOrg?: string;                    // Payer's NPI if applicable
  type: 'commercial' | 'medicare' | 'medicaid' | 'tricare' | 'other';
  logoUrl?: string;
  website?: string;
  contactEmail?: string;
  contactPhone?: string;
}

/**
 * Enrollment evidence/document
 */
export interface EnrollmentEvidence {
  id: string;
  type: EvidenceType;
  filename: string;
  uploadedAt: string;
  expiresAt?: string;                 // For time-limited documents
  verified: boolean;
  verifiedAt?: string;
  verifiedBy?: string;
  url?: string;                       // Download URL
  size?: number;                      // File size in bytes
  mimeType?: string;
}

/**
 * Enrollment status event/timeline entry
 */
export interface EnrollmentEvent {
  id: string;
  timestamp: string;
  eventType: 'created' | 'submitted' | 'status_change' | 'document_added' | 'note_added' | 'revalidation_started' | 'revalidation_completed';
  status?: PayerEnrollmentStatus;
  actor?: string;                     // User who triggered the event
  note?: string;
  metadata?: Record<string, any>;
}

/**
 * Payer enrollment record
 */
export interface PayerEnrollment {
  id: string;
  clinicianNpi: string;
  clinicianName?: string;
  payerId: string;
  payer: PayerInfo;

  status: PayerEnrollmentStatus;
  productLines: ProductLine[];

  // Dates
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  effectiveDate?: string;             // When enrollment becomes effective
  terminationDate?: string;
  lastUpdated: string;

  // Revalidation
  nextRevalidation?: string;          // Next required revalidation date
  revalidationFrequency?: number;     // Months between revalidations (e.g., 36 for 3 years)

  // Evidence
  evidence: EnrollmentEvidence[];

  // Timeline
  events: EnrollmentEvent[];

  // Data sources
  caqhProviderId?: string;
  vitalcvCredentialIds?: string[];    // VitalCV credential IDs used

  // Notes
  notes?: string;
}

/**
 * Draft enrollment data (prepopulated from CAQH + VitalCV)
 */
export interface EnrollmentDraftData {
  payerId: string;
  clinicianNpi: string;
  productLines: ProductLine[];

  // Prepopulated fields
  prepopulated: {
    fromCaqh: {
      attestationDate?: string;
      demographics?: any;
      licenses?: any[];
      certifications?: any[];
    };
    fromVitalCV: {
      credentials?: string[];
      licenses?: any[];
      certifications?: any[];
    };
  };

  // Missing items that need to be provided
  missingItems: {
    field: string;
    label: string;
    required: boolean;
    type: 'document' | 'text' | 'date' | 'select';
  }[];

  // Additional documents needed
  requiredDocuments: EvidenceType[];
}

/**
 * Revalidation reminder
 */
export interface RevalidationReminder {
  enrollmentId: string;
  payerName: string;
  dueDate: string;
  daysRemaining: number;
  severity: 'info' | 'warning' | 'urgent';  // 90 days = info, 60 = warning, 30 = urgent
  dismissed?: boolean;
}

/**
 * Billing/enrollment volume metrics
 */
export interface PayerBillingMetrics {
  payerId: string;
  payerName: string;

  // Current month
  currentMonth: {
    enrollments: number;
    newEnrollments: number;
    revalidations: number;
  };

  // Historical
  monthlyTrend: {
    month: string;                    // YYYY-MM
    enrollments: number;
    charges?: number;                 // Optional billing amounts
  }[];

  // Status breakdown
  statusBreakdown: {
    status: PayerEnrollmentStatus;
    count: number;
  }[];
}

/**
 * Application status chip data (for job applications)
 */
export interface ApplicationPayerStatus {
  jobId: string;
  payerId?: string;
  payerName?: string;

  // Status based on underlying enrollment
  chipStatus: 'payer_ready' | 'enrollment_pending' | 'enrollment_required' | 'not_applicable';
  chipLabel: string;
  chipTooltip: string;

  // Underlying enrollment if exists
  enrollmentId?: string;
  enrollmentStatus?: PayerEnrollmentStatus;
}

/**
 * API response wrapper for payer enrollment list
 */
export interface PayerEnrollmentListResponse {
  enrollments: PayerEnrollment[];
  total: number;
  page?: number;
  pageSize?: number;
}

/**
 * Filter options for enrollment list
 */
export interface PayerEnrollmentFilters {
  status?: PayerEnrollmentStatus[];
  payerId?: string;
  productLine?: ProductLine;
  revalidationDue?: boolean;          // Filter for upcoming revalidations
  search?: string;                    // Search by payer name or clinician
}

