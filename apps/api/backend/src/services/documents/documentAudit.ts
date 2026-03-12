/**
 * documentAudit.ts — Wave 237: Document Intelligence Audit Integration
 *
 * Thin wrappers over appendAuditEvent for document parse and verify operations.
 */

import { appendAuditEvent } from '../audit/auditLedger';
import type { DocumentExtractionResult } from '../ai/documentPipeline';

/**
 * Emit an audit event after a successful document parse.
 */
export function auditParse(
  clerkUserId: string,
  extraction: DocumentExtractionResult,
  filename: string,
): void {
  appendAuditEvent({
    category: ['VERIFICATION'],
    actor: clerkUserId,
    resource: extraction.documentId,
    severity: 'INFO',
    requestFields: {
      filename,
    },
    resultFields: {
      documentType: extraction.documentType,
      overallConfidence: extraction.overallConfidence,
      fieldCount: extraction.extractedFields.length,
    },
  });
}

/**
 * Emit an audit event after a document verification attempt.
 * Severity is WARNING when discrepancies are found or verification fails.
 */
export function auditVerify(
  clerkUserId: string,
  documentId: string,
  verified: boolean,
  discrepancies: number,
): void {
  appendAuditEvent({
    category: ['VERIFICATION'],
    actor: clerkUserId,
    resource: documentId,
    severity: verified ? 'INFO' : 'WARNING',
    requestFields: {
      documentId,
    },
    resultFields: {
      verified,
      discrepancies,
    },
  });
}
