import { Router, type Request, type Response } from 'express';
import { recordInboundMessage } from './message-log';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const payload = (req.body ?? {}) as Record<string, any>;
  const messageType: string = payload?.message?.type ?? payload?.['@type'] ?? 'unknown';
  const threadId: string =
    payload?.message?.thread_id ??
    payload?.['~thread']?.thid ??
    payload?.thread_id ??
    payload?.threadId ??
    payload?.['@id'] ??
    'unknown';

  try {
    await recordInboundMessage({
      threadId,
      connectionId: payload.connection_id ?? payload.connectionId ?? null,
      messageType,
      payload,
    });

    const responseBody = handleMessageType(messageType, payload);
    return res.json(responseBody);
  } catch (error) {
    console.error('[aries][inbound] failed to record message', error);
    return res.status(500).json({
      error: 'aries_inbound_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function handleMessageType(messageType: string, payload: Record<string, any>) {
  if (messageType.includes('issue-credential')) {
    return {
      status: 'received',
      action: 'credential_flow',
      message: 'Credential issue event processed',
    };
  }

  if (messageType.includes('present-proof')) {
    return {
      status: 'received',
      action: 'proof_flow',
      message: 'Proof presentation event recorded',
    };
  }

  if (messageType.includes('trust_ping')) {
    return {
      status: 'alive',
      action: 'ping',
      message: 'Trust ping acknowledged',
    };
  }

  if (messageType.includes('ack')) {
    return {
      status: 'acknowledged',
      action: 'ack',
      message: 'Acknowledgement recorded',
    };
  }

  return {
    status: 'received',
    action: 'noop',
    message: `Unhandled DIDComm message type ${messageType}`,
  };
}

export default router;










