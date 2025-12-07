import { Router, type Request, type Response } from 'express';
import {
  enqueueHitlTask,
  getHitlQueueSnapshot,
  listHitlTasks,
  pendingHitlTasks,
} from '../../services/ai/override';

const router = Router();

router.post('/ai/hitl/queue', (req: Request, res: Response) => {
  const { decisionId, reason, requestedBy, priority, instructions, context, ttlMinutes } =
    req.body ?? {};

  if (!decisionId || typeof decisionId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'decision_id_required',
    });
  }

  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'reason_required',
    });
  }

  if (!requestedBy || typeof requestedBy !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'requested_by_required',
    });
  }

  const task = enqueueHitlTask({
    decisionId,
    reason,
    requestedBy,
    priority,
    instructions,
    context,
    ttlMinutes,
  });

  const snapshot = getHitlQueueSnapshot();

  return res.status(202).json({
    success: true,
    task,
    queue: snapshot,
    pending: pendingHitlTasks(decisionId),
  });
});

router.get('/ai/hitl/queue', (_req: Request, res: Response) => {
  const tasks = listHitlTasks(100);
  const snapshot = getHitlQueueSnapshot();
  return res.json({
    success: true,
    tasks,
    queue: snapshot,
  });
});

export default router;










