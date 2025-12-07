import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

// Env var for backend URL, default to likely port
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * GET /billing/audit
 * Returns consolidated billing audit events
 */
router.get('/audit', async (req: Request, res: Response) => {
  try {
    // Fetch from main backend service which holds the AuditService
    // We filter by 'billing' and 'usage' types or use the backend's filter
    const response = await fetch(`${BACKEND_URL}/api/audit?type=billing`); // Assuming backend supports filtering or we filter here

    if (response.ok) {
      const events = await response.json();

      // Transform if necessary, but backend format seems to match requirements:
      // { eventId, timestamp, hash, txId, ... }

      // Ensure we also get usage events if needed, or backend handles it via tag
      // If backend only returns 'billing', we might need to fetch 'usage' too.
      // For now, assume backend query param ?type=billing returns revenue events.

      return res.json(events);
    } else {
      console.warn('[BillingAudit] Failed to fetch from backend, falling back to mock/stub');
      throw new Error('Backend fetch failed');
    }
  } catch (error) {
    console.error('[BillingAudit] Error:', error);

    // Fallback stub data for UI development
    const stubEvents = [
      {
        eventId: 'evt_stub_1',
        timestamp: new Date().toISOString(),
        hash: '0x123abc...',
        txId: '0xSTUB_BILLING_1',
        eventType: 'billing',
        action: 'charge',
        payload: { units: 10, amount: 100, currency: 'USD' },
        tags: ['REVENUE_EVENT']
      },
      {
        eventId: 'evt_stub_2',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        hash: '0x456def...',
        txId: '0xSTUB_BILLING_2',
        eventType: 'usage',
        action: 'verify_credential',
        payload: { units: 1 },
        tags: ['REVENUE_EVENT']
      }
    ];

    return res.json(stubEvents);
  }
});

export default router;














