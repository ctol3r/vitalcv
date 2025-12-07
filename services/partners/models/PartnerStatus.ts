/**
 * B248A-PARTNER-005: PartnerStatus lifecycle
 *
 * Defines enum of partner statuses (draft/under_review/approved/active/suspended/terminated);
 * ensures state transitions follow business rules via transition helper methods
 */

import { PartnerStatus } from '@prisma/client';

/**
 * Valid status transitions
 */
const VALID_TRANSITIONS: Record<PartnerStatus, PartnerStatus[]> = {
  [PartnerStatus.draft]: [PartnerStatus.under_review, PartnerStatus.draft],
  [PartnerStatus.under_review]: [
    PartnerStatus.approved,
    PartnerStatus.draft,
    PartnerStatus.under_review,
  ],
  [PartnerStatus.approved]: [PartnerStatus.active, PartnerStatus.approved],
  [PartnerStatus.active]: [PartnerStatus.suspended, PartnerStatus.active, PartnerStatus.terminated],
  [PartnerStatus.suspended]: [PartnerStatus.active, PartnerStatus.terminated, PartnerStatus.suspended],
  [PartnerStatus.terminated]: [PartnerStatus.terminated], // Terminal state
};

/**
 * Check if a status transition is valid
 */
export function canTransition(
  from: PartnerStatus,
  to: PartnerStatus
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Get valid next statuses for a given status
 */
export function getValidNextStatuses(current: PartnerStatus): PartnerStatus[] {
  return VALID_TRANSITIONS[current] ?? [];
}

/**
 * Validate status transition
 */
export function validateTransition(
  from: PartnerStatus,
  to: PartnerStatus
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid status transition from ${from} to ${to}. Valid transitions: ${getValidNextStatuses(from).join(', ')}`
    );
  }
}

/**
 * Check if status is terminal (no further transitions allowed except to itself)
 */
export function isTerminalStatus(status: PartnerStatus): boolean {
  const validNext = getValidNextStatuses(status);
  return validNext.length === 1 && validNext[0] === status;
}

/**
 * Check if status allows active operations
 */
export function isActiveStatus(status: PartnerStatus): boolean {
  return status === PartnerStatus.active;
}

/**
 * Check if status is in review
 */
export function isReviewStatus(status: PartnerStatus): boolean {
  return status === PartnerStatus.under_review;
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: PartnerStatus): string {
  const displayNames: Record<PartnerStatus, string> = {
    [PartnerStatus.draft]: 'Draft',
    [PartnerStatus.under_review]: 'Under Review',
    [PartnerStatus.approved]: 'Approved',
    [PartnerStatus.active]: 'Active',
    [PartnerStatus.suspended]: 'Suspended',
    [PartnerStatus.terminated]: 'Terminated',
  };
  return displayNames[status] ?? status;
}

/**
 * Get all statuses
 */
export function getAllStatuses(): PartnerStatus[] {
  return Object.values(PartnerStatus);
}

