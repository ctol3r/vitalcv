import type { CustodyTimelineEntry } from './log';
import { listCustodyTimeline } from './log';
import type { CustodyValidationResult } from './validate';
import { validateCustodyChain } from './validate';
import { stitchCustodyBlock } from './stitch';

export type DocumentLinkStatus = 'linked' | 'missing_anchor' | 'hash_mismatch' | 'validation_failed';

export interface DocumentLinkInput {
  clinicianId: string;
  documentId: string;
  expectedCredentialId?: string;
  expectedIssuerDid?: string;
  expectedCredentialHash?: string;
  timeline?: CustodyTimelineEntry[];
}

export interface DocumentLinkResult {
  status: DocumentLinkStatus;
  clinicianId: string;
  documentId: string;
  credentialId?: string | null;
  custodyRoot?: string;
  anchorTx?: string | null;
  anchorRoot?: string | null;
  validation: CustodyValidationResult;
  issues: string[];
}

export async function linkDocumentToCredential(
  input: DocumentLinkInput,
): Promise<DocumentLinkResult> {
  const timeline =
    input.timeline ??
    (await listCustodyTimeline({
      clinicianId: input.clinicianId,
      documentId: input.documentId,
      direction: 'asc',
    }));

  if (!timeline.length) {
    return {
      status: 'missing_anchor',
      clinicianId: input.clinicianId,
      documentId: input.documentId,
      validation: {
        valid: false,
        issues: [{ code: 'no_events', message: 'No custody records found for document' }],
        orderedActions: [],
        earliestEvent: null,
        latestEvent: null,
        expectedIssuer: input.expectedIssuerDid,
      },
      issues: ['no_custody_data'],
    };
  }

  const validation = await validateCustodyChain({
    timeline,
    expectedIssuerDid: input.expectedIssuerDid,
  });

  const anchorEvent =
    timeline.find((entry) => entry.action === 'anchored') ?? timeline[timeline.length - 1];
  const latest = timeline[timeline.length - 1];

  const issues: string[] = [];
  const credentialId = anchorEvent.metadata?.credentialId ?? latest.metadata?.credentialId ?? null;

  if (!timeline.some((entry) => entry.action === 'anchored')) {
    issues.push('anchor_event_missing');
  }

  if (input.expectedCredentialId && credentialId && credentialId !== input.expectedCredentialId) {
    issues.push('credential_id_mismatch');
  }

  const finalHash = latest.metadata?.hash ?? null;
  if (
    input.expectedCredentialHash &&
    finalHash &&
    input.expectedCredentialHash !== finalHash
  ) {
    issues.push('hash_mismatch');
  }

  const block = stitchCustodyBlock(timeline);

  let status: DocumentLinkStatus = 'linked';
  if (!validation.valid) {
    status = 'validation_failed';
  } else if (issues.includes('hash_mismatch')) {
    status = 'hash_mismatch';
  } else if (issues.includes('anchor_event_missing')) {
    status = 'missing_anchor';
  }

  return {
    status,
    clinicianId: input.clinicianId,
    documentId: input.documentId,
    credentialId,
    custodyRoot: block.custodyRoot,
    anchorTx: anchorEvent.metadata?.anchorTx ?? null,
    anchorRoot: anchorEvent.metadata?.anchorRoot ?? block.custodyRoot,
    validation,
    issues,
  };
}










