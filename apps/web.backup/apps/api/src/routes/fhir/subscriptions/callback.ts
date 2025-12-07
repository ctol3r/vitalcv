import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eventBus } from '../../../../../backend/src/services/notifications/eventBus';

const router = Router();

function stringifyPayload(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body ?? {});
}

function timingSafeCompare(a: string, b: string): boolean {
  let aBuffer: Buffer;
  let bBuffer: Buffer;
  try {
    aBuffer = Buffer.from(a, 'hex');
    bBuffer = Buffer.from(b, 'hex');
  } catch {
    return false;
  }

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

router.post('/callback', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const signature = (req.header('x-fhir-signature') || req.header('x-signature'))?.trim();

    if (signature) {
      const secret = process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET;
      if (!secret) {
        return res.status(500).json({
          success: false,
          error: 'CALLBACK_SIGNATURE_NOT_CONFIGURED',
        });
      }

      const computed = crypto
        .createHmac('sha256', secret)
        .update(stringifyPayload(payload))
        .digest('hex');

      if (!timingSafeCompare(signature, computed)) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_SIGNATURE',
        });
      }
    }

    const topic = req.header('x-fhir-topic') ?? 'external';
    eventBus.emitEvent('FHIRSubscriptionNotification', {
      topic,
      data: payload,
      headers: {
        'x-fhir-topic': req.header('x-fhir-topic') ?? undefined,
        'x-request-id': req.header('x-request-id') ?? undefined,
      },
      receivedAt: new Date().toISOString(),
    });

    return res.status(202).json({
      success: true,
      acknowledged: true,
    });
  } catch (error) {
    console.error('[POST /fhir/subscriptions/callback] Failed to process callback', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

export default router;
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { eventBus } from '../../../../../backend/src/services/notifications/eventBus';

const router = Router();

function stringifyPayload(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }
  return JSON.stringify(body ?? {});
}

function timingSafeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a, 'hex');
  const bBuffer = Buffer.from(b, 'hex');
  if (aBuffer.length !== bBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

router.post('/callback', (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const signature = (req.header('x-fhir-signature') || req.header('x-signature'))?.trim();

    if (signature) {
      const secret = process.env.FHIR_SUBSCRIPTION_CALLBACK_SECRET;
      if (!secret) {
        return res.status(500).json({
          success: false,
          error: 'CALLBACK_SIGNATURE_NOT_CONFIGURED',
        });
      }

      const computed = crypto
        .createHmac('sha256', secret)
        .update(stringifyPayload(payload))
        .digest('hex');

      if (!timingSafeCompare(signature, computed)) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_SIGNATURE',
        });
      }
    }

    const topic = req.header('x-fhir-topic') ?? 'external';
    eventBus.emitEvent('FHIRSubscriptionNotification', {
      topic,
      data: payload,
      headers: {
        'x-fhir-topic': req.header('x-fhir-topic') ?? undefined,
        'x-request-id': req.header('x-request-id') ?? undefined,
      },
      receivedAt: new Date().toISOString(),
    });

    return res.status(202).json({
      success: true,
      acknowledged: true,
    });
  } catch (error) {
    console.error('[POST /fhir/subscriptions/callback] Failed to process callback', error);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
    });
  }
});

export default router;

