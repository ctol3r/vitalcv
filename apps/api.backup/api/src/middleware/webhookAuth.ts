/**
 * Webhook Authentication Middleware
 * Tagged: cursor-batch-1105 (Task 0009)
 * Agent: CODEX • BACKEND • chai-vc-platform
 */

import { Request, Response, NextFunction } from 'express';
import { verifyWebhookSignature, parseWebhookSignatureHeader } from '../lib/webhook/hmac';
import { WebhookSignatureError } from '../lib/http/errors';

export interface WebhookAuthOptions {
  /**
   * HMAC secret key (or function to retrieve it)
   */
  secret: string | ((req: Request) => string | Promise<string>);

  /**
   * Maximum allowed timestamp drift in seconds
   * Default: 60 seconds (configurable via WEBHOOK_MAX_SKEW env var)
   */
  maxTimestampSkew?: number;

  /**
   * Header name for signature (default: X-Webhook-Signature)
   */
  signatureHeader?: string;
}

/**
 * Express middleware for webhook HMAC verification
 */
export function webhookAuth(options: WebhookAuthOptions) {
  const {
    secret,
    maxTimestampSkew = parseInt(process.env.WEBHOOK_MAX_SKEW || '60', 10),
    signatureHeader = 'x-webhook-signature',
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get signature header
      const header = req.get(signatureHeader);
      if (!header) {
        throw new WebhookSignatureError(`Missing ${signatureHeader} header`);
      }

      // Parse signature header
      const { timestamp, signature } = parseWebhookSignatureHeader(header);

      // Resolve secret (may be async)
      const secretKey = typeof secret === 'function' ? await secret(req) : secret;

      // Verify signature
      verifyWebhookSignature(
        {
          timestamp,
          data: req.body,
        },
        signature,
        {
          secret: secretKey,
          maxTimestampSkew,
        },
      );

      // Attach verified timestamp to request
      (req as any).webhookTimestamp = timestamp;

      next();
    } catch (error) {
      if (error instanceof WebhookSignatureError) {
        next(error);
      } else {
        next(new WebhookSignatureError(`Webhook verification failed: ${(error as Error).message}`));
      }
    }
  };
}

/**
 * Create a simple webhook auth middleware with static secret
 */
export function createWebhookAuth(secret: string, maxTimestampSkew?: number) {
  return webhookAuth({ secret, maxTimestampSkew });
}

