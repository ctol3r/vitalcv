/**
 * B148A-NOTIF-008: Webhook Dispatcher
 *
 * Dispatcher for sending webhooks to subscribed organizations.
 * In MVP, network calls are stubbed.
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { getServiceLogger } from '../logging/serviceLogger';
import { serializeError } from '@chai-vc/logging-core';

const prisma = new PrismaClient();
const log = getServiceLogger('notifications/webhookDispatcher');

/**
 * Calculate HMAC signature for webhook payload
 */
function calculateHmacSignature(payload: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Dispatch webhook for a given event
 *
 * Finds all active subscriptions matching the eventType and orgId,
 * then POSTs JSON payload with HMAC signature header.
 *
 * In MVP, network calls are stubbed (logs instead of actual POST).
 */
export async function dispatchWebhook(
  eventType: string,
  orgId: string,
  payload: any
): Promise<{ sent: number; failed: number }> {
  // Find all active subscriptions matching eventType and orgId
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: {
      eventType,
      orgId,
      isActive: true,
    },
  });

  if (subscriptions.length === 0) {
    log.info('No webhook subscriptions found', { eventType, orgId });
    return { sent: 0, failed: 0 };
  }

  const payloadString = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  // Dispatch to each subscription
  for (const subscription of subscriptions) {
    try {
      const signature = calculateHmacSignature(
        payloadString,
        subscription.secret
      );

      // In MVP, stub network call (log instead of actual POST)
      log.info('Webhook dispatcher stub call', {
        targetUrl: subscription.targetUrl,
        eventType,
        orgId,
        signature,
        payload: payloadString,
      });

      // In production, this would be:
      // await fetch(subscription.targetUrl, {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'X-Webhook-Signature': signature,
      //     'X-Webhook-Event': eventType,
      //   },
      //   body: payloadString,
      // });

      sent++;
    } catch (error) {
      log.error('Failed to dispatch webhook', {
        targetUrl: subscription.targetUrl,
        error: serializeError(error),
      });
      failed++;
    }
  }

  return { sent, failed };
}

/**
 * Test helper to verify HMAC signature calculation
 */
export function testHmacSignature(payload: string, secret: string): string {
  return calculateHmacSignature(payload, secret);
}

