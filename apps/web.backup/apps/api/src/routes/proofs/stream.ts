import { Router, type Request, type Response } from 'express';
import { listProofEvents, summarizeProofThread } from '../../services/proofs/stream';

const router = Router();

router.get('/proofs/stream/:threadId', async (req: Request, res: Response) => {
  const { threadId } = req.params;
  if (!threadId) {
    return res.status(400).json({
      error: 'missing_thread_id',
      message: 'threadId path parameter is required',
    });
  }

  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  try {
    const [events, summary] = await Promise.all([
      listProofEvents(threadId, {
        limit,
        order: 'asc',
      }),
      summarizeProofThread(threadId),
    ]);

    if (!summary) {
      return res.status(404).json({
        error: 'thread_not_found',
        message: `No proof stream events recorded for ${threadId}`,
      });
    }

    return res.json({
      threadId,
      summary,
      events,
    });
  } catch (error) {
    console.error('[proofs:stream] failed', error);
    return res.status(500).json({
      error: 'proof_stream_failed',
      message: error instanceof Error ? error.message : 'Unable to load proof stream',
    });
  }
});

export default router;









