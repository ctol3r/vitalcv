/**
 * Shared enrollment status enum used across payer APIs, audit logs, and services.
 */
export enum EnrollmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  DENIED = 'DENIED',
  TERMINATED = 'TERMINATED'
}

const VALID_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  [EnrollmentStatus.DRAFT]: [EnrollmentStatus.SUBMITTED],
  [EnrollmentStatus.SUBMITTED]: [
    EnrollmentStatus.APPROVED,
    EnrollmentStatus.DENIED,
    EnrollmentStatus.DRAFT
  ],
  [EnrollmentStatus.APPROVED]: [EnrollmentStatus.TERMINATED],
  [EnrollmentStatus.DENIED]: [EnrollmentStatus.DRAFT],
  [EnrollmentStatus.TERMINATED]: []
} as const;

export const ENROLLMENT_STATUS_SEQUENCE: readonly EnrollmentStatus[] = Object.freeze([
  EnrollmentStatus.DRAFT,
  EnrollmentStatus.SUBMITTED,
  EnrollmentStatus.APPROVED,
  EnrollmentStatus.DENIED,
  EnrollmentStatus.TERMINATED
]);

/**
 * Helper to validate payer enrollment status transitions.
 */
export function canTransitionStatus(
  currentStatus: EnrollmentStatus,
  newStatus: EnrollmentStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(newStatus) ?? false;
}

