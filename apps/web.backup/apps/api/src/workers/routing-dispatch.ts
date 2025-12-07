import cron from 'node-cron';
import { createHash } from 'crypto';
import { Prisma, PrismaClient, type RoutingRequest } from '@prisma/client';
import { getServiceLogger } from '../../../../services/logging/serviceLogger';
import type { RoutingEnvelope, RoutingTargetSystem } from '../services/routing/engine';
import { anchorRoutingDispatch } from '../services/audit/anchor';

const prisma = new PrismaClient();
const log = getServiceLogger('api/workers/routing-dispatch');

const DEFAULT_CRON = process.env.ROUTING_DISPATCH_CRON?.trim() || '*/2 * * * *';
const MAX_BATCH = Number(process.env.ROUTING_DISPATCH_BATCH ?? 20);
const MAX_RETRIES = Number(process.env.ROUTING_DISPATCH_RETRIES ?? 3);
const REQUEST_TIMEOUT_MS = Number(process.env.ROUTING_DISPATCH_TIMEOUT_MS ?? 12_000);

const TARGET_ENDPOINTS: Record<RoutingTargetSystem, string> = {
  ATS: process.env.ROUTING_ENDPOINT_ATS ?? 'https://integrations.vitalcv.health/ats/deliver',
  EHR: process.env.ROUTING_ENDPOINT_EHR ?? 'https://integrations.vitalcv.health/ehr/launch',
  CVO: process.env.ROUTING_ENDPOINT_CVO ?? 'https://integrations.vitalcv.health/cvo/ingest',
  'TEFCA Node':
    process.env.ROUTING_ENDPOINT_TEFCA ?? 'https://integrations.vitalcv.health/tefca/directory',
};

let cronTask: cron.ScheduledTask | null = null;

export interface RoutingDispatchOptions {
  limit?: number;
  dryRun?: boolean;
}

export function startRoutingDispatchWorker(): cron.ScheduledTask {
  if (cronTask) {
    return cronTask;
  }

  log.info('Starting routing dispatch worker', { schedule: DEFAULT_CRON });
  cronTask = cron.schedule(DEFAULT_CRON, async () => {
    try {
      const processed = await runRoutingDispatchBatch();
      if (processed > 0) {
        log.info('Routing dispatch batch complete', { processed });
      }
    } catch (error) {
      log.error('Routing dispatch batch failed', { error });
    }
  });

  return cronTask;
}

export async function runRoutingDispatchBatch(
  options: RoutingDispatchOptions = {},
): Promise<number> {
  const limit = options.limit ?? MAX_BATCH;
  const pending = await prisma.routingRequest.findMany({
    where: { status: 'pending' },
    take: limit,
    orderBy: { createdAt: 'asc' },
  });

  if (!pending.length) {
    return 0;
  }

  let processed = 0;
  for (const request of pending) {
    try {
      await dispatchRoutingRequest(request, options);
      processed += 1;
    } catch (error) {
      log.error('Routing request failed after retries', {
        requestId: request.id,
        clinicianId: request.clinicianId,
        error,
      });
    }
  }

  return processed;
}

async function dispatchRoutingRequest(
  request: RoutingRequest,
  options: RoutingDispatchOptions,
): Promise<'sent' | 'acked' | 'failed' | 'pending'> {
  const envelope = extractEnvelope(request);
  const endpoint = resolveEndpoint(request.targetSystem as RoutingTargetSystem);
  const envelopeHash = hashEnvelope(envelope);
  const now = new Date().toISOString();

  if (options.dryRun) {
    log.info('Routing dispatch dry-run', { requestId: request.id, endpoint });
    return 'pending';
  }

  let attempt = 0;
  let lastError: Error | null = null;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    try {
      const response = await postEnvelope(endpoint, envelope);
      const status: 'sent' | 'acked' = response.acknowledged ? 'acked' : 'sent';
      await prisma.routingRequest.update({
        where: { id: request.id },
        data: {
          status,
          payload: mergePayload(request, {
            lastDispatch: {
              endpoint,
              status,
              attempt,
              responseCode: response.status,
              acknowledged: response.acknowledged,
              timestamp: now,
            },
          }),
        },
      });

      anchorRoutingDispatch({
        clinicianId: request.clinicianId,
        targetSystem: request.targetSystem,
        method: envelope.method,
        status,
        requestId: request.id,
        envelopeHash,
      });

      return status;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      log.warn('Routing dispatch attempt failed', {
        requestId: request.id,
        attempt,
        error: lastError.message,
      });
      if (attempt < MAX_RETRIES) {
        await delay(200 * attempt);
      }
    }
  }

  await prisma.routingRequest.update({
    where: { id: request.id },
    data: {
      status: 'failed',
      payload: mergePayload(request, {
        lastDispatch: {
          endpoint,
          status: 'failed',
          attempt,
          error: lastError?.message ?? 'Unknown error',
          timestamp: now,
        },
      }),
    },
  });

  anchorRoutingDispatch({
    clinicianId: request.clinicianId,
    targetSystem: request.targetSystem,
    method: envelope.method,
    status: 'failed',
    requestId: request.id,
    envelopeHash,
  });

  if (lastError) {
    throw lastError;
  }

  return 'failed';
}

function extractEnvelope(request: RoutingRequest): RoutingEnvelope {
  if (!request.payload || typeof request.payload !== 'object') {
    throw new Error(`Routing request ${request.id} missing payload`);
  }
  const container = request.payload as Record<string, unknown>;
  const envelope = container.envelope as RoutingEnvelope | undefined;
  if (!envelope || typeof envelope !== 'object') {
    throw new Error(`Routing request ${request.id} missing envelope`);
  }
  if (!envelope.method || !envelope.body) {
    throw new Error(`Routing request ${request.id} has incomplete envelope`);
  }
  return envelope;
}

function resolveEndpoint(target: RoutingTargetSystem): string {
  const endpoint = TARGET_ENDPOINTS[target];
  if (!endpoint) {
    throw new Error(`No routing endpoint configured for ${target}`);
  }
  return endpoint;
}

interface DispatchResponse {
  status: number;
  acknowledged: boolean;
}

async function postEnvelope(
  endpoint: string,
  envelope: RoutingEnvelope,
): Promise<DispatchResponse> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : undefined;
  const timer =
    controller &&
    setTimeout(() => {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': envelope.headers?.['Content-Type'] ?? 'application/json',
        ...(envelope.headers ?? {}),
      },
      body: JSON.stringify(envelope.body),
      signal: controller?.signal,
    });

    const payload = await parseResponseBody(response);
    if (!response.ok) {
      const error = typeof payload === 'string' ? payload : JSON.stringify(payload);
      throw new Error(`Routing endpoint responded with ${response.status}: ${error}`);
    }

    const acknowledged =
      typeof payload === 'object' &&
      payload !== null &&
      (payload['ack'] === true ||
        payload['status'] === 'acked' ||
        payload['state'] === 'acked');

    return {
      status: response.status,
      acknowledged,
    };
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('json')) {
    return response.json().catch(() => ({}));
  }
  const text = await response.text();
  return text;
}

function mergePayload(
  request: RoutingRequest,
  patch: Record<string, unknown>,
): Prisma.JsonObject {
  const base =
    request.payload && typeof request.payload === 'object'
      ? { ...(request.payload as Record<string, unknown>) }
      : {};
  return {
    ...base,
    ...patch,
  } as Prisma.JsonObject;
}

function hashEnvelope(envelope: RoutingEnvelope): string {
  return createHash('sha256').update(JSON.stringify(envelope)).digest('hex');
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}











