import { Router, Request, Response } from 'express';
import { listRecentThreads } from '../../services/didcomm/tracer';

const router = Router();

router.get('/didcomm/inbox', async (_req: Request, res: Response) => {
  try {
    const threads = await listRecentThreads(50);
    return res.json({
      items: threads.map((thread) => ({
        threadId: thread.threadId,
        parentThreadId: thread.parentThreadId,
        auditEventId: thread.auditEventId,
        messageType: thread.messageType,
        status: thread.status,
        connectionId: thread.connectionId,
        updatedAt: thread.updatedAt.toISOString(),
        metadata: thread.metadata,
      })),
    });
  } catch (error) {
    console.error('[didcomm:inbox] failed to list threads', error);
    return res.status(500).json({
      error: 'inbox_unavailable',
      message: error instanceof Error ? error.message : 'Unable to load DIDComm inbox',
    });
  }
});

export default router;











