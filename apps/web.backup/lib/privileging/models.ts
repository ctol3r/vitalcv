/**
 * Facility Privileging Engine - Core Models
 * Phase 1: Privilege Model + Core Logic
 */

import { z } from 'zod';

/**
 * Privilege Status Enum
 * Eligible: All requirements met, ready for granting
 * Conditional: Some requirements met, needs additional verification
 * Denied: Requirements not met or blocked
 */
export enum PrivilegeStatus {
  Eligible = 'Eligible',
  Conditional = 'Conditional',
  Denied = 'Denied',
}

/**
 * Privilege Model
 * Defines a procedure privilege with all requirements
 */
export const PrivilegeSchema = z.object({
  id: z.string().optional(),
  procedureName: z.string().min(1, 'Procedure name is required'),
  specialty: z.string().min(1, 'Specialty is required'),
  privilegeCode: z.string().regex(/^[A-Z0-9-]+$/, 'Privilege code must be uppercase alphanumeric with dashes'),
  requiredCredentials: z.array(z.string()).default([]),
  requiredSkills: z.array(z.string()).default([]),
  requiredAttestations: z.array(z.string()).default([]),
  deaRequired: z.boolean().default(false),
  mateRequired: z.boolean().default(false),
  deaSchedules: z.array(z.string()).default([]),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  description: z.string().optional(),
  facilityUnits: z.array(z.string()).default([]), // OR, ICU, ED, etc.
  isActive: z.boolean().default(true),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type Privilege = z.infer<typeof PrivilegeSchema>;

/**
 * Privilege Requirement Result
 * Tracks verification status for each requirement
 */
export interface PrivilegeRequirementResult {
  type: 'credential' | 'skill' | 'attestation' | 'dea' | 'mate' | 'chain' | 'compliance';
  identifier: string;
  verified: boolean;
  confidence: number; // 0-100
  evidence?: string[];
  blockers?: string[];
  expiresAt?: string;
}

/**
 * Privilege Eligibility Result
 * Complete evaluation result for a privilege
 */
export interface PrivilegeEligibilityResult {
  privilege: Privilege;
  status: PrivilegeStatus;
  confidenceScore: number; // 0-100
  requirements: PrivilegeRequirementResult[];
  riskScore: number; // 0-100
  nextSteps: string[]; // AI-generated suggestions
  blockers: string[];
  grantedAt?: string;
  expiresAt?: string;
  conditions?: string[]; // For conditional status
}

/**
 * Facility Privilege Set
 * Collection of privileges for a specific facility unit
 */
export interface FacilityPrivilegeSet {
  facilityId: string;
  facilityName: string;
  unit: string; // OR, ICU, ED, Cardiology, Psych, etc.
  privileges: Privilege[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Clinician Profile
 * Maps to privilege sets based on specialty and credentials
 */
export interface ClinicianProfile {
  clinicianId: string;
  npi?: string;
  specialty: string;
  specialties: string[];
  credentials: Array<{
    type: string;
    identifier: string;
    issuer: string;
    issuedAt: string;
    expiresAt?: string;
    verified: boolean;
  }>;
  skills: Array<{
    name: string;
    verified: boolean;
    verifiedAt?: string;
    verifiedBy?: string;
    competencyScore?: number;
  }>;
  attestations: Array<{
    type: string;
    attestedBy: string;
    attestedAt: string;
    expiresAt?: string;
  }>;
  deaRegistration?: {
    number: string;
    schedules: string[];
    expiresAt?: string;
  };
  mateRegistration?: {
    number: string;
    expiresAt?: string;
  };
  chainAnchors: Array<{
    anchorId: string;
    txHash: string;
    network: string;
    timestamp: string;
  }>;
  riskFactors: string[];
}

/**
 * Privilege Request
 * Request for a privilege with evidence submission
 */
export interface PrivilegeRequest {
  id: string;
  clinicianId: string;
  privilegeCode: string;
  facilityId: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'denied' | 'conditional';
  evidence: Array<{
    type: string;
    documentId?: string;
    url?: string;
    verified: boolean;
  }>;
  skillAttestations: Array<{
    skillName: string;
    attestedBy: string;
    attestedAt?: string;
    required: boolean;
  }>;
  readinessScore: number; // 0-100
  reviewedBy?: string;
  reviewedAt?: string;
  onChainHash?: string;
  conditions?: string[];
}

/**
 * Privilege Grant Event
 * Chain-anchored event for privilege granting
 */
export interface PrivilegeGrantEvent {
  eventId: string;
  privilegeCode: string;
  clinicianId: string;
  facilityId: string;
  grantedBy: string;
  grantedAt: string;
  status: PrivilegeStatus;
  expiresAt?: string;
  onChainHash: string;
  txHash: string;
  blockHash: string;
  network: string;
  metadata?: Record<string, unknown>;
}

