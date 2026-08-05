/**
 * Durable audit for clinician activation — Wave 1076 B1.
 *
 * Every mutating action writes an `AuditEvent` before its 2xx. This is a
 * different responsibility from the activation analytics event: analytics
 * measures a funnel and may be sampled, dropped or disabled; the audit record
 * is the durable receipt that a change to a person's professional profile
 * happened, who made it, and when.
 *
 * What is deliberately NOT in the metadata: the NPI, the clinician's name,
 * credential values, correction text, or any source-returned professional
 * information. An audit trail that carries the profile recreates the exposure
 * it exists to police — and this table is read by operators, not just by the
 * clinician it concerns. The draft's row id is the join key for anyone with
 * authority to look further.
 */

import { randomUUID } from 'node:crypto';

import prisma from '../../graphql/prisma_client';
import { sha256ForPayload } from '../../utils/deterministic';

export type ActivationAuditAction =
  | 'CLINICIAN_PROFILE_CLAIMED'
  | 'CLINICIAN_PROFILE_CORRECTED'
  | 'CLINICIAN_PROFILE_REVIEW_CONFIRMED'
  | 'CLINICIAN_PROFILE_SHARING_CONFIRMED'
  | 'CLINICIAN_PROFILE_SAVED'
  | 'CLINICIAN_PROFILE_ACTIVATED';

/** Metadata that may be recorded. Counts and flags only — never values. */
export interface ActivationAuditMetadata {
  registryAnswered?: boolean;
  observedFieldCount?: number;
  correctedFieldCount?: number;
  /** Which fields were touched — KEYS ONLY, never their values. */
  correctedFieldKeys?: string[];
  missingRequiredCount?: number;
}

/**
 * Write the durable receipt.
 *
 * Deliberately NOT swallowed: if the audit write fails, the caller's mutation
 * must not report success. A 2xx with no audit record is exactly the state this
 * exists to make impossible, so the error propagates and the route returns 5xx.
 */
export async function writeActivationAudit(
  action: ActivationAuditAction,
  userId: string,
  draftId: string,
  metadata: ActivationAuditMetadata = {},
  client: { auditEvent: { create: (args: unknown) => Promise<unknown> } } = prisma as never,
): Promise<void> {
  await client.auditEvent.create({
    data: {
      id: randomUUID(),
      type: action,
      hash: sha256ForPayload({ action, userId, draftId, ...metadata }),
      referenceId: draftId,
      clinicianId: userId,
      metadata: { ...metadata, actorUserId: userId },
    },
  });
}
