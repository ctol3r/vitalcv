import { createHmac, randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

export const INTEGRATION_WEBHOOK_EVENT_TYPES = [
  'manifest.generated',
  'employer.accepted',
  'drift.detected',
] as const;

export type IntegrationWebhookEventType =
  (typeof INTEGRATION_WEBHOOK_EVENT_TYPES)[number];

export interface IntegrationWebhookPayload {
  eventType: IntegrationWebhookEventType;
  subjectNpi: string;
  manifestId: string | null;
  timestamp: string;
}

export interface CreateIntegrationWebhookSubscriptionInput {
  url: string;
  events: IntegrationWebhookEventType[];
  organizationId?: string | null;
  signingSecret?: string | null;
}

export interface IntegrationWebhookSubscriptionRecord {
  id: string;
  organizationId: string | null;
  url: string;
  events: IntegrationWebhookEventType[];
  active: boolean;
  failureCount: number;
  lastDeliveredAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
}

export interface EnqueueIntegrationWebhookInput {
  eventType: IntegrationWebhookEventType;
  subjectNpi: string;
  manifestId?: string | null;
  timestamp?: string;
  organizationId?: string | null;
  dedupeKey: string;
}

interface IntegrationWebhookOutboxPayload {
  subscriptionId: string;
  organizationId: string | null;
  delivery: IntegrationWebhookPayload;
}

const INTEGRATION_WEBHOOK_AGGREGATE_TYPE = 'INTEGRATION_WEBHOOK';
const FETCH_TIMEOUT_MS = 5_000;
const MAX_ATTEMPTS = 4;

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function sanitizeString(value: unknown, maxLength = 2048): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function isIntegrationWebhookEventType(value: unknown): value is IntegrationWebhookEventType {
  return typeof value === 'string'
    && INTEGRATION_WEBHOOK_EVENT_TYPES.includes(value as IntegrationWebhookEventType);
}

function normalizeEvents(value: unknown): IntegrationWebhookEventType[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized = value
    .filter(isIntegrationWebhookEventType);

  return Array.from(new Set(normalized));
}

function normalizeUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('Webhook URL must be a valid absolute URL.');
  }

  const isHttps = parsed.protocol === 'https:';
  const isLocalhostHttp = parsed.protocol === 'http:' && (
    parsed.hostname === 'localhost'
    || parsed.hostname === '127.0.0.1'
  );

  if (!isHttps && !isLocalhostHttp) {
    throw new Error('Webhook URL must use https or localhost http.');
  }

  return parsed.toString();
}

function normalizeSigningSecret(value: string | null | undefined): string {
  const secret = sanitizeString(value, 512);
  return secret ?? randomUUID();
}

function mapSubscription(row: {
  id: string;
  organizationId: string | null;
  url: string;
  events: string[];
  active: boolean;
  failureCount: number;
  lastDeliveredAt: Date | null;
  lastFailureAt: Date | null;
  createdAt: Date;
}): IntegrationWebhookSubscriptionRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    url: row.url,
    events: row.events.filter(isIntegrationWebhookEventType),
    active: row.active,
    failureCount: row.failureCount,
    lastDeliveredAt: row.lastDeliveredAt?.toISOString() ?? null,
    lastFailureAt: row.lastFailureAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createIntegrationWebhookSubscription(
  input: CreateIntegrationWebhookSubscriptionInput,
): Promise<{ subscription: IntegrationWebhookSubscriptionRecord; signingSecret: string }> {
  const url = normalizeUrl(input.url);
  const events = normalizeEvents(input.events);

  if (events.length === 0) {
    throw new Error('At least one supported event type is required.');
  }

  const signingSecret = normalizeSigningSecret(input.signingSecret);
  const organizationId = sanitizeString(input.organizationId, 128);
  const select = {
    id: true,
    organizationId: true,
    url: true,
    events: true,
    active: true,
    failureCount: true,
    lastDeliveredAt: true,
    lastFailureAt: true,
    createdAt: true,
  } as const;
  const existing = await prisma.integrationWebhookSubscription.findFirst({
    where: {
      organizationId,
      url,
    },
    select,
  });

  const created = existing
    ? await prisma.integrationWebhookSubscription.update({
        where: { id: existing.id },
        data: {
          events,
          signingSecret,
          active: true,
        },
        select,
      })
    : await prisma.integrationWebhookSubscription.create({
        data: {
          organizationId,
          url,
          signingSecret,
          events,
        },
        select,
      });

  log('info', 'integration_webhook_subscription_created', {
    subscriptionId: created.id,
    organizationId,
    events,
  });

  return {
    subscription: mapSubscription(created),
    signingSecret,
  };
}

export async function enqueueIntegrationWebhookEvent(
  input: EnqueueIntegrationWebhookInput,
): Promise<number> {
  const timestamp = sanitizeString(input.timestamp, 64) ?? new Date().toISOString();
  const delivery: IntegrationWebhookPayload = {
    eventType: input.eventType,
    subjectNpi: input.subjectNpi,
    manifestId: sanitizeString(input.manifestId, 256) ?? null,
    timestamp,
  };

  const subscriptions = await prisma.integrationWebhookSubscription.findMany({
    where: {
      active: true,
      events: { has: input.eventType },
      ...(input.organizationId
        ? {
            OR: [
              { organizationId: input.organizationId },
              { organizationId: null },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      organizationId: true,
    },
  });

  if (subscriptions.length === 0) {
    return 0;
  }

  const results = await Promise.allSettled(
    subscriptions.map((subscription) => {
      const outboxPayload: IntegrationWebhookOutboxPayload = {
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        delivery,
      };

      return prisma.outboxEvent.upsert({
        where: {
          dedupeKey: [
            'integration-webhook',
            subscription.id,
            input.eventType,
            input.dedupeKey,
          ].join(':'),
        },
        update: {
          payload: toJsonValue(outboxPayload),
          status: 'PENDING',
          availableAt: new Date(),
          lastError: null,
        },
        create: {
          eventType: input.eventType,
          aggregateType: INTEGRATION_WEBHOOK_AGGREGATE_TYPE,
          aggregateId: subscription.id,
          payload: toJsonValue(outboxPayload),
          dedupeKey: [
            'integration-webhook',
            subscription.id,
            input.eventType,
            input.dedupeKey,
          ].join(':'),
          status: 'PENDING',
          attemptCount: 0,
          availableAt: new Date(),
        },
        select: {
          id: true,
        },
      });
    }),
  );

  const queued = results.filter((result) => result.status === 'fulfilled').length;
  const failed = results.length - queued;

  if (failed > 0) {
    log('warn', 'integration_webhook_enqueue_partial_failure', {
      eventType: input.eventType,
      subjectNpi: input.subjectNpi,
      queued,
      failed,
    });
  }

  return queued;
}

export function parseIntegrationWebhookOutboxPayload(value: unknown): IntegrationWebhookOutboxPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Webhook outbox payload must be an object.');
  }

  const payload = value as Partial<IntegrationWebhookOutboxPayload>;
  if (!payload.subscriptionId || typeof payload.subscriptionId !== 'string') {
    throw new Error('Webhook outbox payload is missing subscriptionId.');
  }

  if (!payload.delivery || typeof payload.delivery !== 'object' || Array.isArray(payload.delivery)) {
    throw new Error('Webhook outbox payload is missing delivery.');
  }

  const delivery = payload.delivery as Partial<IntegrationWebhookPayload>;
  if (!isIntegrationWebhookEventType(delivery.eventType)) {
    throw new Error('Webhook outbox payload contains an unsupported eventType.');
  }
  if (!delivery.subjectNpi || typeof delivery.subjectNpi !== 'string') {
    throw new Error('Webhook outbox payload is missing subjectNpi.');
  }
  if (!delivery.timestamp || typeof delivery.timestamp !== 'string') {
    throw new Error('Webhook outbox payload is missing timestamp.');
  }

  return {
    subscriptionId: payload.subscriptionId,
    organizationId:
      typeof payload.organizationId === 'string' && payload.organizationId.trim().length > 0
        ? payload.organizationId
        : null,
    delivery: {
      eventType: delivery.eventType,
      subjectNpi: delivery.subjectNpi,
      manifestId:
        typeof delivery.manifestId === 'string' && delivery.manifestId.trim().length > 0
          ? delivery.manifestId
          : null,
      timestamp: delivery.timestamp,
    },
  };
}

export async function deliverIntegrationWebhook(
  payload: IntegrationWebhookOutboxPayload,
): Promise<void> {
  const subscription = await prisma.integrationWebhookSubscription.findUnique({
    where: { id: payload.subscriptionId },
    select: {
      id: true,
      url: true,
      signingSecret: true,
      active: true,
    },
  });

  if (!subscription?.active) {
    throw new Error(`Webhook subscription ${payload.subscriptionId} is inactive or missing.`);
  }

  const body = JSON.stringify(payload.delivery);
  const signature = createHmac('sha256', subscription.signingSecret)
    .update(body)
    .digest('hex');

  const response = await fetch(subscription.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VitalCV-Event': payload.delivery.eventType,
      'X-VitalCV-Signature': `sha256=${signature}`,
      'X-VitalCV-Timestamp': payload.delivery.timestamp,
      'User-Agent': 'VitalCV-Integration/1.0',
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Webhook delivery failed with status ${response.status}.`);
  }
}

export async function markIntegrationWebhookDeliverySuccess(
  subscriptionId: string,
  outboxId: string,
): Promise<void> {
  const deliveredAt = new Date();

  await prisma.$transaction([
    prisma.outboxEvent.update({
      where: { id: outboxId },
      data: {
        status: 'DELIVERED',
        lastError: null,
        dispatchedAt: deliveredAt,
      },
    }),
    prisma.integrationWebhookSubscription.updateMany({
      where: { id: subscriptionId },
      data: {
        lastDeliveredAt: deliveredAt,
      },
    }),
  ]);
}

function nextDelayMs(attemptCount: number): number {
  return 1_000 * Math.pow(2, Math.max(0, attemptCount));
}

export async function markIntegrationWebhookDeliveryFailure(
  subscriptionId: string | null,
  outboxId: string,
  attemptCount: number,
  error: unknown,
): Promise<void> {
  const nextAttemptCount = attemptCount + 1;
  const terminalFailure = nextAttemptCount >= MAX_ATTEMPTS;
  const lastError = error instanceof Error ? error.message : String(error);
  const failedAt = new Date();

  if (!subscriptionId) {
    await prisma.outboxEvent.update({
      where: { id: outboxId },
      data: {
        status: terminalFailure ? 'FAILED' : 'PENDING',
        attemptCount: nextAttemptCount,
        lastError,
        availableAt: terminalFailure
          ? failedAt
          : new Date(Date.now() + nextDelayMs(attemptCount)),
      },
    });
    return;
  }

  await prisma.$transaction([
    prisma.outboxEvent.update({
      where: { id: outboxId },
      data: {
        status: terminalFailure ? 'FAILED' : 'PENDING',
        attemptCount: nextAttemptCount,
        lastError,
        availableAt: terminalFailure
          ? failedAt
          : new Date(Date.now() + nextDelayMs(attemptCount)),
      },
    }),
    prisma.integrationWebhookSubscription.updateMany({
      where: { id: subscriptionId },
      data: {
        failureCount: { increment: 1 },
        lastFailureAt: failedAt,
      },
    }),
  ]);
}

export const integrationWebhookAggregateType = INTEGRATION_WEBHOOK_AGGREGATE_TYPE;
