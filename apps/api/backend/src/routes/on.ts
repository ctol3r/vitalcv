import { Router } from 'express';
import prisma from '../graphql/prisma_client';

const router = Router();

const CRITICAL_FAILURE_TYPES = new Set(['WORLD_ID_VERIFY_FAILURE', 'WORLD_ID_VERIFY_ERROR']);

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

router.get('/on-status', async (_req, res) => {
  const checkedAt = new Date();
  const windowHours = Number(process.env.ON_STATUS_WINDOW_HOURS || 24);
  const windowStart = new Date(checkedAt.getTime() - windowHours * 60 * 60 * 1000);

  const dbOk = await prisma.$queryRaw`SELECT 1`
    .then(() => true)
    .catch(() => false);

  let recentEvents: Array<{
    type: string;
    credentialId: string | null;
    createdAt: Date;
  }> = [];
  if (dbOk) {
    recentEvents = await prisma.auditEvent.findMany({
      where: { createdAt: { gte: windowStart } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  const recentFailures = recentEvents.filter((event) => CRITICAL_FAILURE_TYPES.has(event.type));
  const hasActivity = recentEvents.length > 0;

  const failureReasons: string[] = [];
  if (!dbOk) failureReasons.push('db_unreachable');
  if (!hasActivity) failureReasons.push('no_recent_audit_events');
  if (recentFailures.length > 0) failureReasons.push('recent_verification_failures');

  const isOn = dbOk && hasActivity && recentFailures.length === 0;
  const lastEvent = recentEvents[0];

  res.json({
    isOn,
    checkedAt: checkedAt.toISOString(),
    windowHours,
    failureReasons,
    signals: {
      database: dbOk,
      recentAuditCount: recentEvents.length,
      lastAuditAt: lastEvent?.createdAt?.toISOString?.() ?? null,
    },
    failureEvents: recentFailures.slice(0, 5).map((event) => ({
      type: event.type,
      credentialId: event.credentialId ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
  });
});

router.get('/on-history', async (_req, res) => {
  const today = startOfUtcDay(new Date());
  const startDate = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
  const endDate = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  let events: Array<{ type: string; createdAt: Date }> = [];
  try {
    events = await prisma.auditEvent.findMany({
      where: { createdAt: { gte: startDate, lt: endDate } },
      orderBy: { createdAt: 'asc' },
    });
  } catch (error) {
    return res.status(503).json({
      error: 'audit_log_unavailable',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  const eventsByDay = new Map<string, typeof events>();
  for (const event of events) {
    const key = toDateKey(event.createdAt);
    const list = eventsByDay.get(key);
    if (list) {
      list.push(event);
    } else {
      eventsByDay.set(key, [event]);
    }
  }

  const days: Array<{ date: string; isOn: boolean; failureReasons: string[]; duration: number }> = [];
  for (let i = 0; i < 30; i += 1) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = toDateKey(date);
    const dayEvents = eventsByDay.get(key) ?? [];
    const failures = dayEvents.filter((event) => CRITICAL_FAILURE_TYPES.has(event.type));
    const hasActivity = dayEvents.length > 0;
    const isOn = hasActivity && failures.length === 0;

    const failureReasons: string[] = [];
    if (!hasActivity) failureReasons.push('no_audit_events');
    if (failures.length > 0) failureReasons.push('verification_failures');

    let duration = 0;
    if (dayEvents.length > 1) {
      const first = dayEvents[0].createdAt.getTime();
      const last = dayEvents[dayEvents.length - 1].createdAt.getTime();
      duration = Math.max(0, Math.round((last - first) / 60000));
    }

    days.push({
      date: key,
      isOn,
      failureReasons,
      duration,
    });
  }

  res.json(days);
});

export { router };
