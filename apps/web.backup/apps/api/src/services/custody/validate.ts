import type { CustodyAction, CustodyTimelineEntry } from './log';
import { CUSTODY_ACTION_SEQUENCE, listCustodyTimeline } from './log';

const ACTION_RANK = new Map<CustodyAction, number>(
  CUSTODY_ACTION_SEQUENCE.map((action, index) => [action, index]),
);

export type CustodyValidationIssueCode =
  | 'no_events'
  | 'issuer_mismatch'
  | 'missing_signature'
  | 'hash_gap'
  | 'order_violation'
  | 'timestamp_regression';

export interface CustodyValidationIssue {
  code: CustodyValidationIssueCode;
  message: string;
  eventId?: string;
  action?: CustodyAction;
}

export interface CustodyValidationResult {
  valid: boolean;
  issues: CustodyValidationIssue[];
  orderedActions: CustodyAction[];
  missingActions?: CustodyAction[];
  earliestEvent?: string | null;
  latestEvent?: string | null;
  expectedIssuer?: string;
}

export interface CustodyValidationInput {
  clinicianId?: string;
  documentId?: string;
  timeline?: CustodyTimelineEntry[];
  expectedIssuerDid?: string;
}

export async function validateCustodyChain(
  input: CustodyValidationInput,
): Promise<CustodyValidationResult> {
  const timeline =
    input.timeline ??
    (await listCustodyTimeline({
      clinicianId: input.clinicianId,
      documentId: input.documentId,
      direction: 'asc',
    }));

  if (!timeline.length) {
    return {
      valid: false,
      issues: [
        {
          code: 'no_events',
          message: 'No custody records found for requested scope',
        },
      ],
      orderedActions: [],
      earliestEvent: null,
      latestEvent: null,
      expectedIssuer: input.expectedIssuerDid,
    };
  }

  const issues: CustodyValidationIssue[] = [];
  const observedActions: CustodyAction[] = [];

  let previousHash: string | null = null;
  let previousTimestamp = 0;
  let previousActionRank = -1;

  for (const entry of timeline) {
    observedActions.push(entry.action);
    const metadata = entry.metadata ?? {};

    if (input.expectedIssuerDid) {
      if (metadata.issuerDid && metadata.issuerDid !== input.expectedIssuerDid) {
        issues.push({
          code: 'issuer_mismatch',
          message: `Event issuer ${metadata.issuerDid} did not match expected ${input.expectedIssuerDid}`,
          eventId: entry.id,
          action: entry.action,
        });
      }

      if (
        (entry.action === 'signed' || entry.action === 'anchored') &&
        (!metadata.signature || !metadata.issuerDid)
      ) {
        issues.push({
          code: 'missing_signature',
          message: `Custody action ${entry.action} is missing issuer signature metadata`,
          eventId: entry.id,
          action: entry.action,
        });
      }
    }

    if (previousHash) {
      if (!metadata.previousHash) {
        issues.push({
          code: 'hash_gap',
          message: `Event ${entry.id} is missing hash link to prior custody record`,
          eventId: entry.id,
          action: entry.action,
        });
      } else if (metadata.previousHash !== previousHash) {
        issues.push({
          code: 'hash_gap',
          message: `Event ${entry.id} references ${metadata.previousHash} but expected ${previousHash}`,
          eventId: entry.id,
          action: entry.action,
        });
      }
    }

    const rank = ACTION_RANK.get(entry.action) ?? previousActionRank;
    if (rank < previousActionRank) {
      issues.push({
        code: 'order_violation',
        message: `Action ${entry.action} was recorded after a later-stage event`,
        eventId: entry.id,
        action: entry.action,
      });
    }
    previousActionRank = Math.max(previousActionRank, rank);

    const timestampValue = new Date(entry.timestamp).getTime();
    if (previousTimestamp && timestampValue < previousTimestamp) {
      issues.push({
        code: 'timestamp_regression',
        message: `Event ${entry.id} timestamp ${entry.timestamp} is earlier than the prior event`,
        eventId: entry.id,
        action: entry.action,
      });
    }
    previousTimestamp = timestampValue;

    previousHash = metadata.hash ?? previousHash;
  }

  const missingActions = CUSTODY_ACTION_SEQUENCE.filter(
    (action) => !observedActions.includes(action),
  );

  return {
    valid: issues.length === 0,
    issues,
    orderedActions: observedActions,
    missingActions: missingActions.length ? missingActions : undefined,
    earliestEvent: timeline[0]?.timestamp ?? null,
    latestEvent: timeline[timeline.length - 1]?.timestamp ?? null,
    expectedIssuer: input.expectedIssuerDid,
  };
}










