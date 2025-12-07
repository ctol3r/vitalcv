import { Router } from 'express';
import { pool } from '../agent/db';
import { bumpReliability } from '../agent/reliability';

export const feedbackRouter = Router();

/**
 * POST /api/agent/feedback
 * Record user feedback on a trace (thumbs up/down)
 * Updates the trace and adjusts reliability scores for used MCPs
 */
feedbackRouter.post('/', async (req, res) => {
  try {
    const { traceId, helpful, used = [] } = req.body;

    if (!traceId) {
      return res.status(400).json({ error: 'traceId is required' });
    }

    if (typeof helpful !== 'boolean') {
      return res.status(400).json({ error: 'helpful must be a boolean' });
    }

    // Update trace with feedback
    await pool.query(
      `UPDATE "AgentTrace"
       SET outcome = jsonb_set(
         outcome,
         '{helpful}',
         to_jsonb($1::boolean),
         true
       )
       WHERE id = $2`,
      [helpful, traceId]
    );

    // Adjust reliability based on feedback
    const delta = helpful ? +1 : -1;
    await bumpReliability(used, delta);

    res.json({
      ok: true,
      message: 'Feedback recorded',
      traceId,
      helpful,
      mcpsUpdated: used.length,
    });
  } catch (error: any) {
    console.error('Error recording feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/agent/feedback/stats
 * Get feedback statistics
 */
feedbackRouter.get('/stats', async (_req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE (outcome->>'helpful')::boolean = true) as helpful_count,
        COUNT(*) FILTER (WHERE (outcome->>'helpful')::boolean = false) as not_helpful_count,
        COUNT(*) FILTER (WHERE outcome->>'helpful' IS NULL) as no_feedback_count
      FROM "AgentTrace"
    `);

    res.json({
      helpful: parseInt(stats.rows[0].helpful_count || '0'),
      notHelpful: parseInt(stats.rows[0].not_helpful_count || '0'),
      noFeedback: parseInt(stats.rows[0].no_feedback_count || '0'),
    });
  } catch (error: any) {
    console.error('Error getting feedback stats:', error);
    res.status(500).json({ error: error.message });
  }
});

