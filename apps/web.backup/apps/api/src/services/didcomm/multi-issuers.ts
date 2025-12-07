import { randomUUID } from 'crypto';
import { didcommFailover } from './fallback';
import { recordThreadTrace } from './tracer';

const DEFAULT_GATEWAY =
  process.env.MULTI_ISSUER_DIDCOMM_GATEWAY || process.env.ACAPY_URL || 'http://localhost:8031';

export type MultiIssuerEvent =
  | 'invite'
  | 'requested'
  | 'signature_recorded'
  | 'fully_signed'
  | 'revoked';

export interface CoIssuerInviteRequest {
  multiCredentialId: string;
  baseCredentialId: string;
  fromDid: string;
  toDids: string[];
  summary?: string;
  metadata?: Record<string, any>;
  threadId?: string;
}

export interface WorkflowUpdateNotification {
  multiCredentialId: string;
  event: Exclude<MultiIssuerEvent, 'invite'>;
  toDids: string[];
  status: string;
  payload?: Record<string, any>;
  threadId?: string;
}

export interface DeliveryReport {
  toDid: string;
  messageId: string;
  status: 'queued' | 'failed';
  error?: string;
}

export function buildMultiIssuerThreadId(id: string): string {
  return `multi-party:${id}`;
}

export async function sendCoIssuerInvites(request: CoIssuerInviteRequest): Promise<DeliveryReport[]> {
  const threadId = request.threadId ?? buildMultiIssuerThreadId(request.multiCredentialId);
  return Promise.all(
    (request.toDids ?? []).map((did) =>
      dispatchEvent({
        threadId,
        event: 'invite',
        recipientDid: did,
        payload: {
          multiCredentialId: request.multiCredentialId,
          baseCredentialId: request.baseCredentialId,
          summary: request.summary ?? 'Multi-party credential issuance request',
          metadata: request.metadata ?? {},
        },
        senderDid: request.fromDid,
      }),
    ),
  );
}

export async function notifyWorkflowUpdate(
  notification: WorkflowUpdateNotification,
): Promise<DeliveryReport[]> {
  const threadId = notification.threadId ?? buildMultiIssuerThreadId(notification.multiCredentialId);
  return Promise.all(
    (notification.toDids ?? []).map((did) =>
      dispatchEvent({
        threadId,
        event: notification.event,
        recipientDid: did,
        payload: {
          multiCredentialId: notification.multiCredentialId,
          status: notification.status,
          metadata: notification.payload ?? {},
        },
      }),
    ),
  );
}

async function dispatchEvent(input: {
  event: MultiIssuerEvent;
  recipientDid: string;
  senderDid?: string;
  payload: Record<string, any>;
  threadId: string;
}): Promise<DeliveryReport> {
  const message = buildDidcommMessage(input);
  const endpoint = resolveInboxEndpoint(input.recipientDid);
  try {
    await didcommFailover.send(endpoint, { content: message });
    await recordThreadTrace({
      threadId: input.threadId,
      auditEventId: input.payload.multiCredentialId ?? input.threadId,
      messageType: `multi.${input.event}`,
      metadata: {
        event: input.event,
        recipient: input.recipientDid,
        payload: input.payload,
      },
      status: 'queued',
    });
    return {
      toDid: input.recipientDid,
      messageId: message.id,
      status: 'queued',
    };
  } catch (error) {
    console.warn('[didcomm][multi] failed to dispatch message', {
      event: input.event,
      recipient: input.recipientDid,
      error,
    });
    return {
      toDid: input.recipientDid,
      messageId: message.id,
      status: 'failed',
      error: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

function buildDidcommMessage(input: {
  event: MultiIssuerEvent;
  recipientDid: string;
  senderDid?: string;
  payload: Record<string, any>;
  threadId: string;
}) {
  const messageId = randomUUID();
  return {
    id: messageId,
    type: resolveMessageType(input.event),
    thid: input.threadId,
    from: input.senderDid ?? process.env.ISSUER_DID ?? 'did:web:vitalcv.multi',
    to: [input.recipientDid],
    created_time: new Date().toISOString(),
    body: {
      goal_code: 'vitalcv.multi.issue',
      event: input.event,
      payload: input.payload,
    },
  };
}

function resolveMessageType(event: MultiIssuerEvent): string {
  switch (event) {
    case 'invite':
      return 'https://didcomm.org/issue-credential/3.0/propose-credential';
    case 'requested':
      return 'https://didcomm.org/issue-credential/3.0/request-credential';
    case 'signature_recorded':
    case 'fully_signed':
      return 'https://didcomm.org/issue-credential/3.0/issue-credential';
    case 'revoked':
      return 'https://didcomm.org/report-problem/3.0/problem-report';
    default:
      return 'https://didcomm.org/issue-credential/3.0/ack';
  }
}

function resolveInboxEndpoint(did: string): string {
  const suffix = encodeURIComponent(did);
  return `${DEFAULT_GATEWAY}/agents/${suffix}/inbox`;
}









