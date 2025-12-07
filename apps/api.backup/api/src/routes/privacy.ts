import { Router } from 'express';

export const privacyRouter = Router();

// Data deletion endpoint
privacyRouter.post('/delete', async (req, res) => {
  const { user_id } = req.body || {};

  if (!user_id) {
    return res.status(400).json({ error: 'missing_user' });
  }

  try {
    // In a real implementation, delete from database
    // For now, log the deletion request
    console.log(`[PRIVACY] Delete request for user: ${user_id}`);

    // Example: await pool.query('DELETE FROM "AgentTrace" WHERE (input->>'user_id')=$1 OR (outcome->>'user_id')=$1', [user_id]);

    return res.json({ ok: true, user_id });
  } catch (error: any) {
    console.error('Deletion error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Retention policy endpoint
privacyRouter.get('/retention', (_req, res) => {
  res.json({
    traces_days: 90,
    mcp_days: 365,
    description: 'Agent traces retained for 90 days, MCP logs for 365 days'
  });
});

