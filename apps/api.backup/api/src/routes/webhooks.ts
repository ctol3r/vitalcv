/**
 * Webhooks System - Round 12
 * Signed events for credential issuance and revocation
 */

import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

/**
 * Sign a webhook payload with HMAC-SHA256
 */
function sign(body: any): string {
  const key = process.env.WEBHOOK_SECRET || 'dev-secret-change-in-production';
  const h = crypto.createHmac('sha256', key).update(JSON.stringify(body)).digest('hex');
  return h;
}

/**
 * Emit a webhook event (for now, just logs; in production would deliver async)
 */
export function emit(event: string, payload: any): void {
  const body = {
    type: event,
    ts: Date.now(),
    payload,
  };
  const sig = sign(body);

  console.log('[webhook]', event, '| signature:', sig.substring(0, 16) + '...');

  // TODO: In production, queue this for async delivery to registered webhook endpoints
  // For now, just logging is sufficient for demo
}

/**
 * POST /api/webhooks/test
 * Test webhook signing
 */
router.post('/test', (req: Request, res: Response) => {
  const testPayload = { test: 'data', timestamp: Date.now() };
  const signature = sign(testPayload);

  res.json({
    ok: true,
    payload: testPayload,
    signature,
    message: 'Webhook signature generated successfully',
  });
});

/**
 * GET /api/webhooks/recent
 * Get recent webhook events (would query from a queue/log in production)
 */
router.get('/recent', (req: Request, res: Response) => {
  res.json({
    events: [],
    message: 'Webhook event log not yet implemented',
  });
});

export const webhooksRouter = router;

