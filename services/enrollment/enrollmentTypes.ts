/**
 * Shared enrollment types for completeness + alignment scoring.
 */

export interface PECOSEnrollment {
  status: 'ENROLLED' | 'PENDING' | 'DEACTIVATED' | 'REVOKED' | 'REVALIDATION_DUE' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
}

export interface MedicaidEnrollment {
  state: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
}

export interface PayerEnrollment {
  payerId: string;
  payerName: string;
  status: 'ENROLLED' | 'PENDING' | 'REJECTED' | 'PANEL_FULL' | 'UNKNOWN';
  enrollmentDate?: Date;
  expiryDate?: Date;
  isRequired?: boolean;
}
