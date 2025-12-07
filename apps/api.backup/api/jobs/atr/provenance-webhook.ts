/**
 * Provenance Webhook Service
 * B104C-ATR-048: ATR reconcile + provenance webhooks (retry)
 *
 * Sends provenance webhooks with delta tracking and retry logic.
 * Tracks what changed in ATR records and notifies subscribers.
 */

import crypto from 'crypto';

export interface ProvenanceDelta {
  eventId: string;
  providerId: string;
  eventType: string;
  previousStatus?: string;
  currentStatus: string;
  previousPayload?: Record<string, any>;
  currentPayload: Record<string, any>;
  changedFields: string[];
  timestamp: number;
}

export interface WebhookConfig {
  url: string;
  secret?: string;
  timeout?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  attempt: number;
  statusCode?: number;
  error?: string;
  deliveredAt?: Date;
}

/**
 * Calculate provenance delta between two states
 */
export function calculateProvenanceDelta(
  eventId: string,
  providerId: string,
  eventType: string,
  previousStatus: string | undefined,
  currentStatus: string,
  previousPayload: Record<string, any> | undefined,
  currentPayload: Record<string, any>
): ProvenanceDelta {
  const changedFields: string[] = [];

  // Compare status
  if (previousStatus !== currentStatus) {
    changedFields.push('status');
  }

  // Compare payload fields
  if (previousPayload && currentPayload) {
    const allKeys = new Set([...Object.keys(previousPayload), ...Object.keys(currentPayload)]);
    for (const key of allKeys) {
      const prev = previousPayload[key];
      const curr = currentPayload[key];
      if (JSON.stringify(prev) !== JSON.stringify(curr)) {
        changedFields.push(`payload.${key}`);
      }
    }
  } else if (currentPayload && !previousPayload) {
    changedFields.push('payload');
  }

  return {
    eventId,
    providerId,
    eventType,
    previousStatus,
    currentStatus,
    previousPayload,
    currentPayload,
    changedFields,
    timestamp: Date.now(),
  };
}

/**
 * Sign webhook payload with HMAC-SHA256
 */
function signWebhook(payload: any, secret: string): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  return hmac.digest('hex');
}

/**
 * Send provenance webhook with retry logic
 */
export async function sendProvenanceWebhook(
  delta: ProvenanceDelta,
  config: WebhookConfig
): Promise<WebhookDeliveryResult> {
  const {
    url,
    secret = process.env.WEBHOOK_SECRET || 'dev-secret',
    timeout = 10000,
    maxRetries = 3,
    initialBackoffMs = 1000,
    maxBackoffMs = 30000,
  } = config;

  const webhookPayload = {
    type: 'atr.provenance.delta',
    eventId: delta.eventId,
    providerId: delta.providerId,
    eventType: delta.eventType,
    delta: {
      previousStatus: delta.previousStatus,
      currentStatus: delta.currentStatus,
      changedFields: delta.changedFields,
      timestamp: delta.timestamp,
    },
    payload: delta.currentPayload,
    timestamp: new Date().toISOString(),
  };

  const signature = signWebhook(webhookPayload, secret);

  let lastError: string | undefined;
  let lastStatusCode: number | undefined;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'atr.provenance.delta',
          'User-Agent': 'VitalCV-ATR/1.0',
        },
        body: JSON.stringify(webhookPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      lastStatusCode = response.status;

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          attempt,
          statusCode: response.status,
          deliveredAt: new Date(),
        };
      }

      // Don't retry on 4xx errors (except 429)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorText = await response.text().catch(() => 'Client error');
        return {
          success: false,
          attempt,
          statusCode: response.status,
          error: `Client error: ${errorText.substring(0, 200)}`,
        };
      }

      // Retry on 429 (rate limit) or 5xx errors
      if (response.status === 429 || response.status >= 500) {
        lastError = `HTTP ${response.status}`;
        if (attempt < maxRetries) {
          const backoffMs = Math.min(
            initialBackoffMs * Math.pow(2, attempt - 1),
            maxBackoffMs
          );
          await new Promise(resolve => setTimeout(resolve, backoffMs));
          continue;
        }
      }

    } catch (error: any) {
      lastError = error.message || 'Unknown error';

      // Don't retry on abort (timeout) if it's the last attempt
      if (error.name === 'AbortError' && attempt === maxRetries) {
        return {
          success: false,
          attempt,
          error: 'Request timeout',
        };
      }

      // Retry on network errors
      if (attempt < maxRetries) {
        const backoffMs = Math.min(
          initialBackoffMs * Math.pow(2, attempt - 1),
          maxBackoffMs
        );
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        continue;
      }
    }
  }

  return {
    success: false,
    attempt: maxRetries,
    statusCode: lastStatusCode,
    error: lastError || 'Max retries exceeded',
  };
}

/**
 * Get webhook URLs from environment or config
 */
export function getProvenanceWebhookUrls(): string[] {
  const urls = process.env.PROVENANCE_WEBHOOK_URLS;
  if (urls) {
    return urls.split(',').map(url => url.trim()).filter(Boolean);
  }
  return [];
}

