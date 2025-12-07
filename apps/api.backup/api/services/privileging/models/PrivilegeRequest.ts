/**
 * S72-D1-C-002: PrivilegeRequest Model
 *
 * Model for tracking clinician privilege requests through the approval workflow.
 * Status flow: PENDING -> UNDER_REVIEW -> APPROVED/DENIED
 */

import { z } from 'zod';
import { ClinicianSnapshotSchema } from '../validators/validatePrivilegeRequest';

/**
 * Valid privilege request statuses
 *
 * Status lifecycle: PENDING -> UNDER_REVIEW -> APPROVED/DENIED
 *
 * @constant {object}
 * @property {string} PENDING - Request submitted, awaiting initial review
 * @property {string} UNDER_REVIEW - Request is being reviewed by credentialing committee
 * @property {string} APPROVED - Request approved, privilege granted
 * @property {string} DENIED - Request denied, see reviewNotes for details
 */
export const PrivilegeRequestStatus = {
  PENDING: 'PENDING',
  UNDER_REVIEW: 'UNDER_REVIEW',
  APPROVED: 'APPROVED',
  DENIED: 'DENIED',
} as const;

export type PrivilegeRequestStatusType = (typeof PrivilegeRequestStatus)[keyof typeof PrivilegeRequestStatus];

/**
 * Schema for creating a new PrivilegeRequest
 */
export const CreatePrivilegeRequestSchema = z
  .object({
    clinicianId: z.string().min(1, 'Clinician ID/DID is required'),
    orgId: z.string().min(1, 'Organization ID is required'),
    privilegeSetId: z.string().min(1).optional(),
    privilegeSetV2Id: z.string().min(1).optional(),
    evidenceIds: z.array(z.string()).default([]),
    evidenceBundle: z.any().optional(), // JSON bundle of supporting VCs/documents
    clinicianSnapshot: ClinicianSnapshotSchema.optional(),
  })
  .refine((data) => data.privilegeSetId || data.privilegeSetV2Id, {
    message: 'Privilege Set ID or Privilege Set V2 ID is required',
    path: ['privilegeSetId'],
  });

export type CreatePrivilegeRequestInput = z.infer<typeof CreatePrivilegeRequestSchema>;

/**
 * Schema for reviewing a PrivilegeRequest (approve/deny)
 */
export const ReviewPrivilegeRequestSchema = z.object({
  reviewerDid: z.string().min(1, 'Reviewer DID is required'),
  reviewNotes: z.string().optional(),
  decision: z.enum(['APPROVED', 'DENIED']),
});

export type ReviewPrivilegeRequestInput = z.infer<typeof ReviewPrivilegeRequestSchema>;

/**
 * Schema for updating request status (with optimistic concurrency control)
 */
export const UpdatePrivilegeRequestStatusSchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED']),
  reviewerDid: z.string().optional(),
  reviewNotes: z.string().optional(),
  rowVersion: z.number().int().positive().optional(), // S72-POST-2A-004: Optional version for optimistic concurrency
});

export type UpdatePrivilegeRequestStatusInput = z.infer<typeof UpdatePrivilegeRequestStatusSchema>;

/**
 * Schema for querying PrivilegeRequests
 */
export const QueryPrivilegeRequestSchema = z.object({
  orgId: z.string().optional(),
  clinicianId: z.string().optional(),
  privilegeSetId: z.string().optional(),
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'DENIED']).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type QueryPrivilegeRequestInput = z.infer<typeof QueryPrivilegeRequestSchema>;

/**
 * Serialize PrivilegeRequest for API response
 */
export function serializePrivilegeRequest(request: any) {
  return {
    id: request.id,
    orgId: request.orgId,
    clinicianDid: request.clinicianDid,
    privilegeSetId: request.privilegeSetId,
    evidenceIds: request.evidenceIds,
    evidenceBundle: request.evidenceBundle,
    status: request.status,
    reviewerDid: request.reviewerDid,
    reviewNotes: request.reviewNotes,
    reviewedAt: request.reviewedAt?.toISOString(),
    rowVersion: request.rowVersion || 1, // S72-POST-2A-004: Include version for optimistic concurrency
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    // Include related data if available
    privilegeSetId: request.privilegeSetId,
    privilegeSetV2Id: request.privilegeSetV2Id,
    privilegeSet: request.privilegeSet
      ? {
          id: request.privilegeSet.id,
          name: request.privilegeSet.name,
          department: request.privilegeSet.department,
        }
      : undefined,
    privilegeSetV2: request.privilegeSetV2
      ? {
          id: request.privilegeSetV2.id,
          name: request.privilegeSetV2.name,
          specialty: request.privilegeSetV2.specialty,
        }
      : undefined,
    privilegeGranted: request.privilegeGranted ? {
      id: request.privilegeGranted.id,
      status: request.privilegeGranted.status,
      grantedAt: request.privilegeGranted.grantedAt?.toISOString(),
      expiresAt: request.privilegeGranted.expiresAt?.toISOString(),
    } : undefined,
  };
}

/**
 * Validate that a privilege request can transition to a new status
 */
export function canTransitionStatus(
  currentStatus: PrivilegeRequestStatusType,
  newStatus: PrivilegeRequestStatusType
): { allowed: boolean; reason?: string } {
  // Status transition rules
  const transitions: Record<PrivilegeRequestStatusType, PrivilegeRequestStatusType[]> = {
    PENDING: ['UNDER_REVIEW', 'APPROVED', 'DENIED'],
    UNDER_REVIEW: ['APPROVED', 'DENIED', 'PENDING'],
    APPROVED: [], // Terminal state
    DENIED: ['PENDING'], // Can resubmit
  };

  const allowedTransitions = transitions[currentStatus];

  if (allowedTransitions.includes(newStatus)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot transition from ${currentStatus} to ${newStatus}`,
  };
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(status: PrivilegeRequestStatusType): string {
  const descriptions: Record<PrivilegeRequestStatusType, string> = {
    PENDING: 'Pending review by organization',
    UNDER_REVIEW: 'Under review by credentialing committee',
    APPROVED: 'Approved - privilege granted',
    DENIED: 'Denied - see review notes for details',
  };

  return descriptions[status];
}

/**
 * S72-POST-2A-004: Check if rowVersion matches for optimistic concurrency control
 * @param currentVersion Current rowVersion in database
 * @param expectedVersion Expected rowVersion from client
 * @returns true if versions match, false if conflict detected
 */
export function checkVersionMatch(currentVersion: number, expectedVersion?: number): { valid: boolean; reason?: string } {
  if (expectedVersion === undefined) {
    // No version provided - allow update (backwards compatible)
    return { valid: true };
  }

  if (currentVersion !== expectedVersion) {
    return {
      valid: false,
      reason: `Version conflict: expected ${expectedVersion}, but current version is ${currentVersion}. Another update occurred concurrently.`,
    };
  }

  return { valid: true };
}

/**
 * S72-POST-2A-004: Optimistic concurrency error class
 */
export class OptimisticConcurrencyError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly currentVersion: number,
    public readonly entityId: string,
    message?: string
  ) {
    super(message || `Optimistic concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion} for entity ${entityId}`);
    this.name = 'OptimisticConcurrencyError';
  }
}

