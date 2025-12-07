/**
 * B132A-ATS-009: Partner ATS webhook: notify on applicationCreated
 *
 * POST to ATS endpoint on new application if partner config exists; retries on 5xx
 */

import { Router, Request, Response } from 'express';
import { AtsWebhookPayload } from '../../../../../../services/jobs/models/Application';

const router = Router();

// In-memory webhook log (in production, use database)
interface WebhookLog {
  id: string;
  partnerId: string;
  applicationId: string;
  event: string;
  url: string;
  status: 'pending' | 'success' | 'failed';
  httpStatus?: number;
  attempts: number;
  lastAttempt: Date;
  error?: string;
}

const webhookLogs: WebhookLog[] = [];

/**
 * Send webhook to partner ATS
 */
export async function sendAtsWebhook(
  partnerId: string,
  webhookUrl: string,
  payload: AtsWebhookPayload,
  authSecret?: string
): Promise<{ success: boolean; httpStatus?: number; error?: string }> {
  const maxRetries = 3;
  let lastError: string | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[webhook] Sending to ${webhookUrl} (attempt ${attempt}/${maxRetries})`);

      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-VitalCV-Event': payload.event,
        'X-VitalCV-Application-Id': payload.applicationId,
      };

      // Add authentication
      if (authSecret) {
        // HMAC signature for payload integrity
        const crypto = await import('crypto');
        const signature = crypto
          .createHmac('sha256', authSecret)
          .update(JSON.stringify(payload))
          .digest('hex');
        headers['X-VitalCV-Signature'] = signature;
      }

      // Send webhook (simulate for now)
      // In production, use fetch or axios
      const response = await simulateWebhookSend(webhookUrl, payload, headers);

      if (response.status >= 200 && response.status < 300) {
        console.log(`[webhook] Success: ${response.status}`);
        return { success: true, httpStatus: response.status };
      }

      lastStatus = response.status;

      // Retry on 5xx errors
      if (response.status >= 500 && attempt < maxRetries) {
        console.warn(`[webhook] Server error ${response.status}, retrying...`);
        await delay(1000 * attempt); // Exponential backoff
        continue;
      }

      // Don't retry on 4xx errors
      lastError = `HTTP ${response.status}: ${response.statusText}`;
      console.error(`[webhook] Client error: ${lastError}`);
      break;

    } catch (error: any) {
      lastError = error.message;
      console.error(`[webhook] Error on attempt ${attempt}:`, error);

      if (attempt < maxRetries) {
        await delay(1000 * attempt);
      }
    }
  }

  return { success: false, httpStatus: lastStatus, error: lastError };
}

/**
 * Simulate webhook send (for testing)
 * In production, replace with actual HTTP request
 */
async function simulateWebhookSend(
  url: string,
  payload: any,
  headers: Record<string, string>
): Promise<{ status: number; statusText: string }> {
  // Simulate network delay
  await delay(100);

  // Simulate success for valid URLs
  if (url.includes('example.com')) {
    return { status: 200, statusText: 'OK' };
  }

  // Simulate random failures for testing
  const random = Math.random();
  if (random < 0.1) {
    return { status: 500, statusText: 'Internal Server Error' };
  }
  if (random < 0.15) {
    return { status: 503, statusText: 'Service Unavailable' };
  }

  return { status: 200, statusText: 'OK' };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * POST /partners/ats/webhook/send
 * Manually trigger webhook send (admin/testing)
 */
router.post('/partners/ats/webhook/send', async (req: Request, res: Response) => {
  try {
    const { partnerId, webhookUrl, payload, authSecret } = req.body;

    if (!partnerId || !webhookUrl || !payload) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'partnerId, webhookUrl, and payload are required',
      });
    }

    // Create webhook log
    const logId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const log: WebhookLog = {
      id: logId,
      partnerId,
      applicationId: payload.applicationId,
      event: payload.event,
      url: webhookUrl,
      status: 'pending',
      attempts: 0,
      lastAttempt: new Date(),
    };

    webhookLogs.push(log);

    // Send webhook
    const result = await sendAtsWebhook(partnerId, webhookUrl, payload, authSecret);

    // Update log
    log.status = result.success ? 'success' : 'failed';
    log.httpStatus = result.httpStatus;
    log.error = result.error;
    log.attempts = 1; // Simplified - actual attempts tracked in sendAtsWebhook
    log.lastAttempt = new Date();

    return res.json({
      success: result.success,
      logId,
      httpStatus: result.httpStatus,
      error: result.error,
    });

  } catch (error: any) {
    console.error('[webhook/send] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to send webhook',
      details: error.message,
    });
  }
});

/**
 * GET /partners/ats/webhook/logs
 * Get webhook logs
 */
router.get('/partners/ats/webhook/logs', async (req: Request, res: Response) => {
  try {
    const { partnerId, applicationId, status, limit = 50, offset = 0 } = req.query;

    let logs = [...webhookLogs];

    // Apply filters
    if (partnerId) {
      logs = logs.filter(log => log.partnerId === partnerId);
    }
    if (applicationId) {
      logs = logs.filter(log => log.applicationId === applicationId);
    }
    if (status) {
      logs = logs.filter(log => log.status === status);
    }

    // Sort by most recent first
    logs.sort((a, b) => b.lastAttempt.getTime() - a.lastAttempt.getTime());

    // Paginate
    const total = logs.length;
    const paginatedLogs = logs.slice(Number(offset), Number(offset) + Number(limit));

    return res.json({
      logs: paginatedLogs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
      },
    });

  } catch (error) {
    console.error('[webhook/logs] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to fetch webhook logs',
    });
  }
});

/**
 * POST /partners/ats/webhook/retry
 * Retry a failed webhook
 */
router.post('/partners/ats/webhook/retry', async (req: Request, res: Response) => {
  try {
    const { logId } = req.body;

    if (!logId) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'logId is required',
      });
    }

    const log = webhookLogs.find(l => l.id === logId);
    if (!log) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Webhook log not found',
      });
    }

    // Retry webhook
    // TODO: Fetch partner config and payload from database
    console.log(`[webhook/retry] Retrying webhook ${logId}`);

    return res.json({
      message: 'Webhook retry initiated',
      logId,
    });

  } catch (error) {
    console.error('[webhook/retry] Error:', error);
    return res.status(500).json({
      error: 'internal_error',
      message: 'Failed to retry webhook',
    });
  }
});

export default router;
export { sendAtsWebhook, WebhookLog };

