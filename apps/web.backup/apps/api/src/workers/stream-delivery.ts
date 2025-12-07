import { randomUUID } from 'crypto';
import fetch from 'node-fetch';
import { PrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import type { StreamEvent } from '../services/stream/types';
import { signStreamPayload, STREAM_SIGNATURE_HEADER, STREAM_TIMESTAMP_HEADER } from '../services/stream/signing';
import { buildDeadLetterPayload, recordDeadLetter } from '../services/stream/dead-letter';

const prisma = new PrismaClient();
const log = getServiceLogger('api/workers/stream-delivery');

const DEFAULT_MAX_RETRIES = Number(process.env.STREAM_MAX_RETRIES ?? 5);
const BASE_BACKOFF_MS = Number(process.env.STREAM_BACKOFF_MS ?? 1500);
const MAX_BACKOFF_EXP = 6;
const HISTORY_LIMIT = 50;

interface DeliveryJob {
  id: string;
  subscriptionId: string;
  endpoint: string;
  secret: string;
  event: StreamEvent;
  attempt: number;
  nextAttemptAt: number;
}

interface DeliveryStats {
  successes: number;
  failures: number;
  lastAttemptAt?: string;
  lastStatus?: 'success' | 'failed';
  lastError?: string;
}

interface DeliveryRecord {
  id: string;
  subscriptionId: string;
  eventId: string;
  eventType: StreamEvent['eventType'];
  topic: StreamEvent['topic'];
  status: 'success' | 'failed';
  attempts: number;
  lastAttemptAt: string;
  note?: string;
}

const queue: DeliveryJob[] = [];
const stats = new Map<string, DeliveryStats>();
const history = new Map<string, DeliveryRecord[]>();
const aggregateHistory: DeliveryRecord[] = [];

let activeWorkers = 0;
let wakeTimer: NodeJS.Timeout | null = null;

export async function enqueueStreamDeliveries(event: StreamEvent): Promise<number> {
  const subscriptions = await prisma.credentialStreamSubscription.findMany({
    where: { orgId: event.orgId, topic: event.topic },
  });

  if (subscriptions.length === 0) {
    log.debug('No stream subscriptions for event', { orgId: event.orgId, topic: event.topic });
    return 0;
  }

  subscriptions.forEach((subscription) => {
    queue.push({
      id: randomUUID(),
      subscriptionId: subscription.id,
      endpoint: subscription.endpoint,
      secret: subscription.secret,
      event,
      attempt: 0,
      nextAttemptAt: Date.now(),
    });
  });

  drainQueue();

  return subscriptions.length;
}

export function getSubscriptionDeliveryStats(subscriptionId: string) {
  const record = stats.get(subscriptionId) ?? { successes: 0, failures: 0 };
  return {
    ...record,
    pending: queue.filter((job) => job.subscriptionId === subscriptionId).length,
  };
}

export function getSubscriptionHistory(subscriptionId: string): DeliveryRecord[] {
  return history.get(subscriptionId) ?? [];
}

export function getRecentDeliveryRecords(limit = 25): DeliveryRecord[] {
  return aggregateHistory.slice(0, limit > 0 ? limit : 0);
}

export function getStreamQueueDepth(): number {
  return queue.length;
}

function drainQueue() {
  if (activeWorkers >= getConcurrency()) {
    return;
  }

  const job = pullReadyJob();
  if (!job) {
    scheduleWake();
    return;
  }

  activeWorkers += 1;
  void deliverJob(job)
    .catch((error) => {
      log.error('Stream delivery job crashed', { error, jobId: job.id });
    })
    .finally(() => {
      activeWorkers -= 1;
      drainQueue();
    });
}

function pullReadyJob(): DeliveryJob | undefined {
  const now = Date.now();
  const index = queue.findIndex((job) => job.nextAttemptAt <= now);
  if (index === -1) {
    return undefined;
  }
  const [job] = queue.splice(index, 1);
  return job;
}

function scheduleWake() {
  if (wakeTimer || queue.length === 0) {
    return;
  }
  const nextAt = queue.reduce((earliest, job) => Math.min(earliest, job.nextAttemptAt), Number.MAX_SAFE_INTEGER);
  const delay = Math.max(100, nextAt - Date.now());
  wakeTimer = setTimeout(() => {
    wakeTimer = null;
    drainQueue();
  }, delay);
}

async function deliverJob(job: DeliveryJob): Promise<void> {
  try {
    await sendWebhook(job);
    recordDelivery(job, 'success');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (job.attempt + 1 >= DEFAULT_MAX_RETRIES) {
      recordDelivery(job, 'failed', message, job.attempt + 1);
      recordDeadLetter({
        subscriptionId: job.subscriptionId,
        endpoint: job.endpoint,
        topic: job.event.topic,
        eventType: job.event.eventType,
        eventId: job.event.id,
        failureReason: message,
        attempts: job.attempt + 1,
        payloadHash: buildDeadLetterPayload(job.event),
        lastError: message,
      });
      log.warn('Stream delivery exhausted retries', {
        jobId: job.id,
        subscriptionId: job.subscriptionId,
        attempts: job.attempt + 1,
      });
    } else {
      job.attempt += 1;
      job.nextAttemptAt = Date.now() + computeBackoff(job.attempt);
      queue.push(job);
      log.warn('Stream delivery retry scheduled', {
        jobId: job.id,
        attempt: job.attempt,
        nextAttemptAt: new Date(job.nextAttemptAt).toISOString(),
      });
      scheduleWake();
    }
  }
}

async function sendWebhook(job: DeliveryJob): Promise<void> {
  const attempt = job.attempt + 1;
  const timestamp = new Date().toISOString();
  const body = JSON.stringify({
    id: job.event.id,
    eventType: job.event.eventType,
    topic: job.event.topic,
    orgId: job.event.orgId,
    payload: job.event.payload,
    chainAnchor: job.event.chainAnchor,
    timestamp: job.event.timestamp,
    delivery: {
      jobId: job.id,
      attempt,
    },
  });

  const signature = signStreamPayload(job.secret, timestamp, body);

  const response = await fetch(job.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [STREAM_TIMESTAMP_HEADER]: timestamp,
      [STREAM_SIGNATURE_HEADER]: signature,
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Webhook responded with ${response.status} ${text}`);
  }
}

function recordDelivery(
  job: DeliveryJob,
  status: 'success' | 'failed',
  note?: string,
  attemptCount = job.attempt + 1,
) {
  const subscriptionStats = stats.get(job.subscriptionId) ?? { successes: 0, failures: 0 };
  if (status === 'success') {
    subscriptionStats.successes += 1;
  } else {
    subscriptionStats.failures += 1;
    subscriptionStats.lastError = note;
  }
  subscriptionStats.lastStatus = status;
  const attemptIso = new Date().toISOString();
  subscriptionStats.lastAttemptAt = attemptIso;
  stats.set(job.subscriptionId, subscriptionStats);

  const record: DeliveryRecord = {
    id: randomUUID(),
    subscriptionId: job.subscriptionId,
    eventId: job.event.id,
    eventType: job.event.eventType,
    topic: job.event.topic,
    status,
    attempts: attemptCount,
    lastAttemptAt: attemptIso,
    note,
  };

  const existing = history.get(job.subscriptionId) ?? [];
  existing.unshift(record);
  history.set(job.subscriptionId, existing.slice(0, HISTORY_LIMIT));

  aggregateHistory.unshift(record);
  if (aggregateHistory.length > HISTORY_LIMIT) {
    aggregateHistory.pop();
  }
}

function computeBackoff(attempt: number): number {
  const exponent = Math.min(attempt, MAX_BACKOFF_EXP);
  return BASE_BACKOFF_MS * 2 ** exponent;
}

function getConcurrency(): number {
  return Math.max(1, Number(process.env.STREAM_DELIVERY_CONCURRENCY ?? 4));
}

