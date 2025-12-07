import { PrismaClient, type ProofStream } from '@prisma/client';

export type ProofStreamEvent = ProofStream;

export type ProofStreamStatus = 'pending' | 'validated' | 'anchored' | 'error';

export interface ProofStreamSummary {
  threadId: string;
  status: ProofStreamStatus;
  eventCount: number;
  lastEvent?: string;
  lastEventAt?: string;
  checkpointCount: number;
  workerStats: Record<
    string,
    {
      count: number;
      lastEventAt: string;
      lastPayload?: Record<string, any>;
    }
  >;
}

const prisma = new PrismaClient();

export async function appendProofEvent(
  threadId: string,
  event: string,
  payload: Record<string, any> = {},
): Promise<void> {
  try {
    await prisma.proofStream.create({
      data: {
        threadId,
        event,
        payload: sanitizePayload(payload),
      },
    });
  } catch (error) {
    console.warn('[proofs][stream] failed to append event', { threadId, event, error });
  }
}

export async function listProofEvents(
  threadId: string,
  options: { limit?: number; order?: 'asc' | 'desc'; sinceTs?: string } = {},
): Promise<ProofStreamEvent[]> {
  const limit = clampLimit(options.limit ?? 250);
  const order = options.order ?? 'asc';

  try {
    return await prisma.proofStream.findMany({
      where: {
        threadId,
        ...(options.sinceTs
          ? {
              ts: {
                gt: new Date(options.sinceTs),
              },
            }
          : {}),
      },
      orderBy: {
        ts: order,
      },
      take: limit,
    });
  } catch (error) {
    console.warn('[proofs][stream] failed to list events', { threadId, error });
    return [];
  }
}

export async function summarizeProofThread(threadId: string): Promise<ProofStreamSummary | null> {
  const events = await listProofEvents(threadId, { order: 'asc', limit: 500 });
  if (!events.length) {
    return null;
  }

  const summary: ProofStreamSummary = {
    threadId,
    status: deriveStatus(events),
    eventCount: events.length,
    lastEvent: events[events.length - 1]?.event,
    lastEventAt: events[events.length - 1]?.ts?.toISOString(),
    checkpointCount: events.filter((event) => event.event === 'anchored').length,
    workerStats: {},
  };

  events.forEach((event) => {
    const worker = (event.payload as Record<string, any>)?.worker;
    if (worker) {
      summary.workerStats[worker] ??= {
        count: 0,
        lastEventAt: event.ts.toISOString(),
      };
      summary.workerStats[worker].count += 1;
      summary.workerStats[worker].lastEventAt = event.ts.toISOString();
      summary.workerStats[worker].lastPayload = coerceRecord(event.payload);
    }
  });

  return summary;
}

function sanitizePayload(payload: Record<string, any>): Record<string, any> {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { detail: 'payload_not_serializable' };
  }
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 50;
  return Math.min(1000, Math.max(10, Math.floor(value)));
}

function deriveStatus(events: ProofStreamEvent[]): ProofStreamStatus {
  const last = events[events.length - 1];
  if (!last) {
    return 'pending';
  }
  if (events.some((event) => event.event === 'error')) {
    return 'error';
  }
  if (events.some((event) => event.event === 'anchored')) {
    return 'anchored';
  }
  if (events.some((event) => event.event === 'validated')) {
    return 'validated';
  }
  return 'pending';
}

function coerceRecord(payload: any): Record<string, any> | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }
  return payload as Record<string, any>;
}









