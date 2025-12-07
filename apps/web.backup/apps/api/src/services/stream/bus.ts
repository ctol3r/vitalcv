import { EventEmitter } from 'events';
import { createHash, randomUUID } from 'crypto';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import {
  type StreamChainAnchor,
  type StreamEvent,
  type StreamEventType,
  type StreamTopic,
} from './types';
import { assertValidStreamEvent } from './validator';
import { enqueueStreamDeliveries } from '../../workers/stream-delivery';

const log = getServiceLogger('api/services/stream/bus');

const emitter = new EventEmitter();
const RECENT_EVENT_LIMIT = 100;
const recentEvents: StreamEvent[] = [];

const TOPIC_BY_EVENT: Record<StreamEventType, StreamTopic> = {
  credentialIssued: 'clinician-updates',
  credentialRevoked: 'revocations',
  statusUpdated: 'status-changes',
  streamSubscriptionRegistered: 'clinician-updates',
};

const THROTTLE_WINDOW_MS = Number(process.env.STREAM_THROTTLE_WINDOW_MS ?? 1000);
const THROTTLE_MAX_PER_WINDOW = Number(process.env.STREAM_THROTTLE_MAX ?? 20);

type OrgWindow = { start: number; count: number };
const orgWindows = new Map<string, OrgWindow>();
const orgQueues = new Map<string, StreamEvent[]>();
const orgTimers = new Map<string, NodeJS.Timeout>();

interface EmitOptions {
  topic?: StreamTopic;
  chainAnchor?: StreamChainAnchor;
  timestamp?: string;
}

export async function emitCredentialIssued(
  orgId: string,
  payload: Record<string, any>,
  options?: EmitOptions,
): Promise<boolean> {
  return emitEvent('credentialIssued', orgId, payload, options);
}

export async function emitCredentialRevoked(
  orgId: string,
  payload: Record<string, any>,
  options?: EmitOptions,
): Promise<boolean> {
  return emitEvent('credentialRevoked', orgId, payload, options);
}

export async function emitStatusUpdated(
  orgId: string,
  payload: Record<string, any>,
  options?: EmitOptions,
): Promise<boolean> {
  return emitEvent('statusUpdated', orgId, payload, options);
}

export async function emitStreamEvent(
  eventType: StreamEventType,
  orgId: string,
  payload: Record<string, any>,
  options?: EmitOptions,
): Promise<boolean> {
  return emitEvent(eventType, orgId, payload, options);
}

export function onStreamEvent(handler: (event: StreamEvent) => void): () => void {
  emitter.on('stream-event', handler);
  return () => emitter.off('stream-event', handler);
}

export function getRecentStreamEvents(limit = 25): StreamEvent[] {
  return recentEvents.slice(0, limit);
}

async function emitEvent(
  eventType: StreamEventType,
  orgId: string,
  payload: Record<string, any>,
  options?: EmitOptions,
): Promise<boolean> {
  const topic = options?.topic ?? TOPIC_BY_EVENT[eventType] ?? 'clinician-updates';
  const event: StreamEvent = {
    id: randomUUID(),
    eventType,
    orgId,
    topic,
    payload: sanitizePayload(payload),
    chainAnchor: options?.chainAnchor ?? buildAnchor(eventType, orgId, payload),
    timestamp: options?.timestamp ?? new Date().toISOString(),
  };

  try {
    assertValidStreamEvent(event);
  } catch (error) {
    log.warn('Rejected invalid stream event', { eventType, orgId, error });
    return false;
  }

  if (isThrottled(orgId)) {
    enqueueBacklog(orgId, event);
    return false;
  }

  dispatch(event);
  return true;
}

function dispatch(event: StreamEvent) {
  trackWindow(event.orgId);
  recentEvents.unshift(event);
  if (recentEvents.length > RECENT_EVENT_LIMIT) {
    recentEvents.pop();
  }
  emitter.emit('stream-event', event);
  enqueueStreamDeliveries(event).catch((error) => {
    log.error('Failed to enqueue stream delivery', { error, eventId: event.id });
  });
}

function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { detail: 'payload_not_serializable' };
  }
}

function buildAnchor(eventType: StreamEventType, orgId: string, payload: Record<string, any>): StreamChainAnchor {
  const base = JSON.stringify({ eventType, orgId, payload });
  const hash = createHash('sha256').update(base).digest('hex');
  return {
    hash: `0x${hash}`,
    network: process.env.VERIFIER_CHAIN_NETWORK || 'pilot-l2',
    anchoredAt: new Date().toISOString(),
  };
}

function isThrottled(orgId: string): boolean {
  const now = Date.now();
  const window = orgWindows.get(orgId);
  if (!window || now - window.start > THROTTLE_WINDOW_MS) {
    orgWindows.set(orgId, { start: now, count: 0 });
    return false;
  }
  return window.count >= THROTTLE_MAX_PER_WINDOW;
}

function trackWindow(orgId: string) {
  const now = Date.now();
  const window = orgWindows.get(orgId);
  if (!window || now - window.start > THROTTLE_WINDOW_MS) {
    orgWindows.set(orgId, { start: now, count: 1 });
  } else {
    window.count += 1;
    orgWindows.set(orgId, window);
  }
}

function enqueueBacklog(orgId: string, event: StreamEvent) {
  const queue = orgQueues.get(orgId) ?? [];
  queue.push(event);
  orgQueues.set(orgId, queue);
  if (!orgTimers.has(orgId)) {
    orgTimers.set(
      orgId,
      setTimeout(() => {
        orgTimers.delete(orgId);
        flushOrgQueue(orgId);
      }, THROTTLE_WINDOW_MS),
    );
  }
}

function flushOrgQueue(orgId: string) {
  const queue = orgQueues.get(orgId);
  if (!queue || queue.length === 0) {
    return;
  }
  orgQueues.delete(orgId);
  queue.forEach((event) => dispatch(event));
}

