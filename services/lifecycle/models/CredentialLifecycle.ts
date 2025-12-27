/**
 * CredentialLifecycle model
 *
 * Captures lifecycle metadata needed for renewal guidance and automation.
 * Additive fields: renewalAuthorityId, renewalMethod.
 */

import { z } from 'zod';

/**
 * Renewal channel supported by lifecycle automation
 */
export enum RenewalMethod {
  ONLINE = 'ONLINE',
  MAIL = 'MAIL',
  IN_PERSON = 'IN_PERSON',
}

/**
 * Lifecycle metadata for a credential
 */
export const CredentialLifecycleSchema = z.object({
  credentialId: z.string().min(1, 'credentialId is required'),
  status: z.string().optional(),
  expiresAt: z.coerce.date().optional(),
  renewalAuthorityId: z.string().optional(),
  renewalMethod: z.nativeEnum(RenewalMethod).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CredentialLifecycle = z.infer<typeof CredentialLifecycleSchema>;

/**
 * Normalize lifecycle metadata from arbitrary credential sources
 */
export function toCredentialLifecycle(input: unknown): CredentialLifecycle {
  return CredentialLifecycleSchema.parse(input);
}

