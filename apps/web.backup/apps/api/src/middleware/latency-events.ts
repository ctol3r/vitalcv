import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface LatencyEvent {
  credentialId: string;
  eventType: 'claimCreated' | 'docsUploaded' | 'PSVCompleted' | 'VCIssued' | 'VCVerified';
  timestamp: Date;
  duration?: number; // milliseconds
}

const eventTimers = new Map<string, Map<string, number>>();

/**
 * Start timer for a latency event
 */
export function startLatencyTimer(credentialId: string, eventType: LatencyEvent['eventType']): void {
  if (!eventTimers.has(credentialId)) {
    eventTimers.set(credentialId, new Map());
  }
  const timers = eventTimers.get(credentialId)!;
  timers.set(eventType, Date.now());
}

/**
 * End timer and record latency event
 */
export async function endLatencyTimer(
  credentialId: string,
  eventType: LatencyEvent['eventType'],
): Promise<void> {
  const timers = eventTimers.get(credentialId);
  if (!timers) return;

  const startTime = timers.get(eventType);
  if (!startTime) return;

  const duration = Date.now() - startTime;
  timers.delete(eventType);

  // Record event
  await recordLatencyEvent({
    credentialId,
    eventType,
    timestamp: new Date(),
    duration,
  });
}

/**
 * Record latency event
 */
export async function recordLatencyEvent(event: LatencyEvent): Promise<void> {
  const existing = await prisma.credentialLatency.findUnique({
    where: { credentialId: event.credentialId },
  });

  const metrics = existing?.metrics as Record<string, unknown> || {};
  const events = (metrics.events as LatencyEvent[]) || [];
  events.push(event);

  // Update metrics
  const stepDurations: Record<string, number> = {};
  const stepOrder = ['claimCreated', 'docsUploaded', 'PSVCompleted', 'VCIssued', 'VCVerified'];

  for (let i = 0; i < events.length; i++) {
    const current = events[i];
    if (current.duration) {
      stepDurations[current.eventType] = current.duration;
    }

    // Compute end-to-end if we have all steps
    if (i === events.length - 1 && stepOrder.every(step => stepDurations[step] !== undefined)) {
      const endToEnd = stepOrder.reduce((sum, step) => sum + (stepDurations[step] || 0), 0);
      metrics.endToEndDuration = endToEnd;
    }
  }

  await prisma.credentialLatency.upsert({
    where: { credentialId: event.credentialId },
    create: {
      credentialId: event.credentialId,
      metrics: {
        events,
        stepDurations,
        ...metrics,
      },
    },
    update: {
      metrics: {
        events,
        stepDurations,
        ...metrics,
      },
      updatedAt: new Date(),
    },
  });
}

