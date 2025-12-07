/**
 * B132A-JOBS-006: Application model linking VC evidence
 *
 * Model for job applications that link verifiable credentials as evidence.
 */

import { z } from 'zod';

// Application submission schema
export const ApplicationSubmissionSchema = z.object({
  applicantDid: z.string().min(1, 'Applicant DID is required'),
  jobId: z.string().min(1, 'Job ID is required'),
  evidenceIds: z.array(z.string()).min(1, 'At least one evidence VC required'),
  evidenceBundle: z.record(z.any()).optional(), // Full signed VC bundle
  metadata: z.record(z.any()).optional(),
});

export type ApplicationSubmission = z.infer<typeof ApplicationSubmissionSchema>;

/**
 * Application status enum
 *
 * Status lifecycle: PENDING -> REVIEWED -> ACCEPTED/REJECTED
 *
 * @enum {string}
 * @property {string} PENDING - Application submitted, awaiting review
 * @property {string} REVIEWED - Application has been reviewed by hiring team
 * @property {string} ACCEPTED - Application accepted (hired)
 * @property {string} REJECTED - Application rejected
 */
export enum ApplicationStatus {
  PENDING = 'PENDING',
  REVIEWED = 'REVIEWED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
}

// Match reason structure
export interface MatchReason {
  specialty: {
    matched: boolean;
    score: number;
    details?: string;
  };
  licenseState: {
    matched: boolean;
    states: string[];
    method?: 'direct' | 'imlc' | 'multi-state';
  };
  telehealth?: {
    eligible: boolean;
    method?: 'imlc' | 'multi-state' | 'single-state';
  };
  overall: {
    score: number;
    rank?: number;
  };
}

// Application with full details (S72-POST-2A-004: Added rowVersion for optimistic concurrency)
export interface ApplicationDetails {
  id: string;
  applicantDid: string;
  jobId: string;
  evidenceIds: string[];
  evidenceBundle?: any;
  status: ApplicationStatus;
  matchScore?: number;
  matchReason?: MatchReason;
  webhookSentAt?: Date;
  webhookStatus?: 'success' | 'failed' | 'pending';
  metadata?: any;
  rowVersion?: number; // S72-POST-2A-004: Optimistic concurrency version
  createdAt: Date;
  updatedAt: Date;
}

// Webhook payload for ATS notification
export interface AtsWebhookPayload {
  event: 'application.created' | 'application.updated';
  applicationId: string;
  jobId: string;
  externalJobId?: string;
  applicantDid: string;
  status: string;
  matchScore?: number;
  evidenceIds: string[];
  createdAt: string;
  metadata?: any;
}

export function validateApplication(data: unknown): ApplicationSubmission {
  return ApplicationSubmissionSchema.parse(data);
}

/**
 * S72-POST-2A-004: Check if rowVersion matches for optimistic concurrency control
 * @param currentVersion Current rowVersion in database
 * @param expectedVersion Expected rowVersion from client
 * @returns true if versions match, false if conflict detected
 */
export function checkApplicationVersionMatch(currentVersion: number, expectedVersion?: number): { valid: boolean; reason?: string } {
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
 * S72-POST-2A-004: Optimistic concurrency error class for Applications
 */
export class ApplicationOptimisticConcurrencyError extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly currentVersion: number,
    public readonly applicationId: string,
    message?: string
  ) {
    super(message || `Optimistic concurrency conflict: expected version ${expectedVersion}, but current version is ${currentVersion} for application ${applicationId}`);
    this.name = 'ApplicationOptimisticConcurrencyError';
  }
}

