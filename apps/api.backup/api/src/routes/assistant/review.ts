import { Router, Request, Response } from 'express';
import { assistantService } from '../../services/assistant/service';

export const reviewRouter = Router();

/**
 * POST /api/assistant/review
 * Summarize documents, flag issues, and propose acceptance/rejection for a credential application
 */
reviewRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { applicationId, userId, orgId } = req.body;

    if (!applicationId || !userId) {
      return res.status(400).json({ error: 'applicationId and userId are required' });
    }

    const reviewResult = await assistantService.reviewApplication(applicationId, userId, orgId);

    res.json(reviewResult);
  } catch (error) {
    console.error('Assistant review error:', error);
    res.status(500).json({
      error: 'Failed to process review',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


