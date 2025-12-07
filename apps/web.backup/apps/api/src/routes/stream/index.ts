import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { normalizeWebhookUrl, generateSigningSecret } from '../ats/utils';
import { isStreamTopic, STREAM_TOPICS, type StreamTopic } from '../../services/stream/types';
import { anchorStreamSubscriptionRegistration } from '../../services/audit/anchor';
import { getRecentStreamEvents } from '../../services/stream/bus';
import {
  getRecentDeliveryRecords,
  getStreamQueueDepth,
  getSubscriptionDeliveryStats,
  getSubscriptionHistory,
} from '../../workers/stream-delivery';
import { getDeadLetterSize, listDeadLetters } from '../../services/stream/dead-letter';

const router = Router();
const prisma = new PrismaClient();

interface SubscribeRequestBody {
  orgId?: string;
  topic?: string;
  endpoint?: string;
  secret?: string;
}

router.post(
  '/api/stream/subscribe',
  async (req: Request<unknown, unknown, SubscribeRequestBody>, res: Response) => {
    try {
      const payload = normalizeSubscribeRequest(req.body);
      const secret = payload.secret ?? generateSigningSecret();

      const record = await prisma.credentialStreamSubscription.create({
        data: {
          orgId: payload.orgId,
          topic: payload.topic,
          endpoint: payload.endpoint,
          secret,
        },
      });

      const subscriptionHash = hashSubscription(record.orgId, record.topic, record.endpoint, secret);
      anchorStreamSubscriptionRegistration({
        subscriptionId: record.id,
        orgId: record.orgId,
        topic: record.topic,
        endpoint: record.endpoint,
        subscriptionHash,
      });

      return res.status(201).json({
        id: record.id,
        orgId: record.orgId,
        topic: record.topic,
        endpoint: record.endpoint,
        secret,
        createdAt: record.createdAt,
      });
    } catch (error) {
      console.error('[stream][subscribe] failed', error);
      return res.status(400).json({
        error: 'stream_subscribe_failed',
        error_description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

router.delete(
  '/api/stream/unsubscribe',
  async (req: Request, res: Response) => {
    const subscriptionId =
      typeof req.body?.subscriptionId === 'string'
        ? req.body.subscriptionId
        : typeof req.query?.id === 'string'
          ? req.query.id
          : undefined;

    if (!subscriptionId) {
      return res.status(400).json({
        error: 'subscription_id_required',
      });
    }

    try {
      await prisma.credentialStreamSubscription.delete({
        where: { id: subscriptionId },
      });
      return res.status(204).end();
    } catch (error) {
      console.warn('[stream][unsubscribe] delete failed', error);
      return res.status(404).json({
        error: 'subscription_not_found',
        error_description: subscriptionId,
      });
    }
  },
);

router.get('/api/stream/subscriptions', async (req: Request, res: Response) => {
  try {
    const orgId = typeof req.query?.orgId === 'string' ? req.query.orgId : undefined;
    const subscriptions = await prisma.credentialStreamSubscription.findMany({
      where: orgId ? { orgId } : undefined,
      orderBy: { createdAt: 'desc' },
    });

    const enriched = subscriptions.map((record) => {
      const delivery = getSubscriptionDeliveryStats(record.id);
      return {
        id: record.id,
        orgId: record.orgId,
        topic: record.topic,
        endpoint: record.endpoint,
        secretPreview: maskSecret(record.secret),
        createdAt: record.createdAt,
        delivery,
        recentDeliveries: getSubscriptionHistory(record.id),
      };
    });

    return res.json({
      topics: STREAM_TOPICS,
      subscriptions: enriched,
      queueDepth: getStreamQueueDepth(),
      recentDeliveries: getRecentDeliveryRecords(25),
      recentEvents: getRecentStreamEvents(25),
      deadLetter: {
        size: getDeadLetterSize(),
        entries: listDeadLetters(15),
      },
    });
  } catch (error) {
    console.error('[stream][subscriptions] fetch failed', error);
    return res.status(500).json({
      error: 'stream_subscriptions_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

function normalizeSubscribeRequest(body: SubscribeRequestBody | undefined | null): {
  orgId: string;
  topic: StreamTopic;
  endpoint: string;
  secret?: string;
} {
  if (!body || typeof body !== 'object') {
    throw new Error('Request body required');
  }
  if (!body.orgId || typeof body.orgId !== 'string') {
    throw new Error('orgId is required');
  }
  if (!body.topic || typeof body.topic !== 'string' || !isStreamTopic(body.topic)) {
    throw new Error('topic must be a supported stream topic');
  }
  if (!body.endpoint || typeof body.endpoint !== 'string') {
    throw new Error('endpoint is required');
  }

  return {
    orgId: body.orgId.trim(),
    topic: body.topic as StreamTopic,
    endpoint: normalizeWebhookUrl(body.endpoint),
    secret: body.secret,
  };
}

function maskSecret(secret: string): string {
  if (!secret) return '';
  return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
}

function hashSubscription(orgId: string, topic: string, endpoint: string, secret: string): string {
  return createHash('sha256').update([orgId, topic, endpoint, secret].join(':')).digest('hex');
}

export default router;









