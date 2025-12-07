/**
 * Webhook HMAC Utilities
 * Tagged: cursor-batch-1105 (Task 0009)
 * Agent: CODEX • BACKEND • chai-vc-platform
 *
 * HMAC signature verification for webhooks with timestamp drift protection
 */

import * as crypto from 'crypto';
import { WebhookSignatureError } from '../http/errors';

export interface WebhookSignatureOptions {
  /**
   * HMAC secret key
   */
  secret: string;

  /**
   * Maximum allowed timestamp drift in seconds (default: 60)
   */
  maxTimestampSkew?: number;

  /**
   * HMAC algorithm (default: sha256)
   */
  algorithm?: string;
}

export interface WebhookPayload {
  /**
   * Unix timestamp when webhook was sent
   */
  timestamp: number;

  /**
   * Webhook payload data
   */
  data: any;
}

/**
 * Generate HMAC signature for webhook payload
 * Format: HMAC-SHA256(secret, timestamp + "." + json_payload)
 */
export function generateWebhookSignature(
  payload: WebhookPayload,
  secret: string,
  algorithm = 'sha256',
): string {
  const message = `${payload.timestamp}.${JSON.stringify(payload.data)}`;
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(message);
  return hmac.digest('hex');
}

/**
 * Verify webhook HMAC signature
 *
 * @throws WebhookSignatureError if signature is invalid or timestamp is out of range
 */
export function verifyWebhookSignature(
  payload: WebhookPayload,
  signature: string,
  options: WebhookSignatureOptions,
): void {
  const { secret, maxTimestampSkew = 60, algorithm = 'sha256' } = options;

  // Check timestamp drift
  const now = Math.floor(Date.now() / 1000);
  const skew = Math.abs(now - payload.timestamp);

  if (skew > maxTimestampSkew) {
    throw new WebhookSignatureError(
      `Timestamp skew too large: ${skew}s (max: ${maxTimestampSkew}s)`,
      {
        timestamp: payload.timestamp.toString(),
        skew,
        maxSkew: maxTimestampSkew,
        now,
      },
    );
  }

  // Verify signature
  const expectedSignature = generateWebhookSignature(payload, secret, algorithm);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new WebhookSignatureError('HMAC signature verification failed', {
      timestamp: payload.timestamp.toString(),
    });
  }
}

/**
 * Parse webhook signature header
 * Format: t=<timestamp>,s=<signature>
 */
export function parseWebhookSignatureHeader(header: string): { timestamp: number; signature: string } {
  const parts = header.split(',');
  let timestamp: number | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key === 't') {
      timestamp = parseInt(value, 10);
    } else if (key === 's') {
      signature = value;
    }
  }

  if (!timestamp || !signature) {
    throw new WebhookSignatureError('Invalid signature header format');
  }

  return { timestamp, signature };
}

/**
 * Create webhook signature header
 * Format: t=<timestamp>,s=<signature>
 */
export function createWebhookSignatureHeader(payload: WebhookPayload, secret: string): string {
  const signature = generateWebhookSignature(payload, secret);
  return `t=${payload.timestamp},s=${signature}`;
}

