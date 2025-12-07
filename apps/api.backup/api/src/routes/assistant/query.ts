import { Router, Request, Response } from 'express';
import { assistantService } from '../../services/assistant/service';
import { reviewRouter } from './review';
import { AssistantType } from '../../services/assistant/context';

export const assistantRouter = Router();

// Mount review router
assistantRouter.use('/review', reviewRouter);

/**
 * POST /api/assistant/query
 * Process a user query with context
 */
assistantRouter.post('/query', async (req: Request, res: Response) => {
  try {
    const { userId, orgId, threadId, message, history = [], assistantType } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message are required' });
    }

    const response = await assistantService.processQuery({
      userId,
      orgId,
      threadId,
      message,
      history,
      assistantType: assistantType as AssistantType
    });

    res.json(response);

  } catch (error) {
    console.error('Assistant query error:', error);
    res.status(500).json({
      error: 'Failed to process assistant query',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


