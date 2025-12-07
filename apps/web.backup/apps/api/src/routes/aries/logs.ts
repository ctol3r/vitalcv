import { Router, type Request, type Response } from 'express';
import { listMessagesByThread } from '../../services/aries/message-log';

const router = Router();

router.get('/:threadId', async (req: Request, res: Response) => {
  const { threadId } = req.params;
  if (!threadId) {
    return res.status(400).json({
      error: 'invalid_request',
      message: 'threadId path parameter is required',
    });
  }

  try {
    const messages = await listMessagesByThread(threadId);
    return res.json({
      threadId,
      total: messages.length,
      messages: messages.map((message) => ({
        id: message.id,
        direction: message.direction,
        type: message.messageType,
        connectionId: message.connectionId,
        payload: message.payload,
        auditId: message.auditId,
        createdAt: message.createdAt,
      })),
    });
  } catch (error) {
    console.error('[aries][logs] failed to read message log', error);
    return res.status(500).json({
      error: 'aries_log_failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;










