/**
 * Batch 62: Current User/Role Endpoint
 * Returns the current user's role for client-side admin guards
 */

import { Router } from 'express';

export const devMe = Router();

devMe.get('/api/dev/me', (req, res) => {
  // Check for role in request context or header
  const role = (req as any).user?.role || req.headers['x-dev-role'] || 'viewer';

  res.json({
    role: String(role).toLowerCase(),
    user: (req as any).user?.id || 'dev',
    timestamp: new Date().toISOString()
  });
});

