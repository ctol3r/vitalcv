/**
 * B136A-TEFCA-006: TEFCA QHIN Configuration Model
 *
 * Stores QHIN endpoint, organization identifier, and allowed Purpose of Use (PoU) values.
 * Enforces PoU-based access control for TEFCA network queries.
 */

import { z } from 'zod';

/**
 * TEFCA Purpose of Use values (based on TEFCA Common Agreement)
 */
export enum TefcaPurposeOfUse {
  TREATMENT = 'TREATMENT',
  PAYMENT = 'PAYMENT',
  OPERATIONS = 'OPERATIONS',
  RESEARCH = 'RESEARCH',
  PUBLIC_HEALTH = 'PUBLIC_HEALTH',
  DIRECTORY = 'DIRECTORY',
}

/**
 * QHIN Configuration Zod Schema
 */
export const QhinConfigSchema = z.object({
  id: z.string().optional(),
  orgId: z.string().min(1, 'Organization ID is required'),
  qhinEndpoint: z.string().url('Must be a valid QHIN endpoint URL'),
  allowedPurposes: z.array(z.nativeEnum(TefcaPurposeOfUse)).min(1, 'At least one allowed purpose is required'),
  orgIdentifier: z.string().min(1, 'Organization identifier is required for TEFCA'),
  authConfig: z.record(z.any()).optional(),
  isActive: z.boolean().default(true),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export type QhinConfig = z.infer<typeof QhinConfigSchema>;

/**
 * Create QHIN Configuration input
 */
export const CreateQhinConfigSchema = QhinConfigSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateQhinConfigInput = z.infer<typeof CreateQhinConfigSchema>;

/**
 * Update QHIN Configuration input
 */
export const UpdateQhinConfigSchema = QhinConfigSchema.partial().required({ orgId: true });

export type UpdateQhinConfigInput = z.infer<typeof UpdateQhinConfigSchema>;

/**
 * Validate if a Purpose of Use is allowed for an organization
 */
export function isPurposeAllowed(config: QhinConfig, purpose: string): boolean {
  return config.allowedPurposes.includes(purpose as TefcaPurposeOfUse);
}

/**
 * TEFCA Purpose of Use metadata for logging and audit
 */
export const TEFCA_PURPOSE_METADATA: Record<TefcaPurposeOfUse, { description: string; requiresAttestation: boolean }> = {
  [TefcaPurposeOfUse.TREATMENT]: {
    description: 'Treatment, care coordination, and related healthcare services',
    requiresAttestation: false,
  },
  [TefcaPurposeOfUse.PAYMENT]: {
    description: 'Payment and financial transaction purposes',
    requiresAttestation: true,
  },
  [TefcaPurposeOfUse.OPERATIONS]: {
    description: 'Healthcare operations and administrative activities',
    requiresAttestation: false,
  },
  [TefcaPurposeOfUse.RESEARCH]: {
    description: 'Research purposes (requires IRB approval)',
    requiresAttestation: true,
  },
  [TefcaPurposeOfUse.PUBLIC_HEALTH]: {
    description: 'Public health activities and reporting',
    requiresAttestation: true,
  },
  [TefcaPurposeOfUse.DIRECTORY]: {
    description: 'Provider directory services',
    requiresAttestation: false,
  },
};

