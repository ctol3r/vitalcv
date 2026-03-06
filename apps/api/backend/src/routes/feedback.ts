/**
 * feedback.ts — Wave 119: Feedback Routes
 *
 * POST /api/feedback          — Submit NPS or feedback
 * GET  /api/feedback/summary  — Aggregate summary
 */

import type { Express, Request, Response } from 'express';
import { submitFeedback, getFeedbackSummary } from '../services/feedback/feedbackService';
import { log } from '../obs/logger';

export function registerFeedbackRoutes(app: Express): void {

  app.post('/api/feedback', async (req: Request, res: Response) => {
    try {
      const { type, message, score, email } = req.body ?? {};
      if (!type || !['nps', 'bug', 'feature'].includes(type)) {
        res.status(400).json({ error: 'type must be nps, bug, or feature' });
        return;
      }
      if (!message || typeof message !== 'string') {
        res.status(400).json({ error: 'message is required' });
        return;
      }
      if (type === 'nps' && (typeof score !== 'number' || score < 0 || score > 10)) {
        res.status(400).json({ error: 'NPS score must be 0–10' });
        return;
      }
      const result = await submitFeedback(type, message, score, email);
      res.status(201).json({ submitted: true, ...result });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log('error', 'feedback_submit_error', { error: msg });
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/feedback/summary', async (_req: Request, res: Response) => {
    try {
      const summary = await getFeedbackSummary();
      res.json(summary);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: msg });
    }
  });
}
