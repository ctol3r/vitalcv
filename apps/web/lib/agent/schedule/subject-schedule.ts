/**
 * A2.1 — per-subject scheduling and claiming for the background loop.
 *
 * ## Enrollment is the allowlist
 *
 * A subject is reachable by the scheduler only because a row exists for them.
 * There is deliberately no predicate ("everyone with a verified NPI", "10% of
 * users") anywhere in this module: a predicate silently widens the cohort as
 * data changes, which is precisely the failure that cohort gating exists to
 * prevent. Enrolling is an explicit act; `enabled: false` pauses without
 * forgetting.
 *
 * ## Claiming is a write
 *
 * A tick claims a subject by moving `nextDueAt` FORWARD in a compare-and-set
 * — `updateMany` filtered on the row still being due, claimed iff exactly one
 * row changed. This is the same discipline as `revocationOutboxWorker`'s
 * PENDING→PROCESSING claim, and it is what makes a retried or concurrent tick
 * find nothing rather than run a subject twice.
 *
 * The claim moves the due time BEFORE the work starts, on purpose. A tick
 * that crashes mid-run leaves the subject scheduled for its next interval
 * rather than immediately re-claimable — a crash loop that re-runs the same
 * subject forever is worse than a skipped cycle.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';

export interface ScheduledSubject {
  id: string;
  subjectRef: string;
  npi: string | null;
  intervalMinutes: number;
  consecutiveFailures: number;
}

export interface EnrollInput {
  subjectRef: string;
  npi?: string;
  intervalMinutes?: number;
  /** First due time. Defaults to immediately. */
  firstDueAt?: Date;
}

const MIN_INTERVAL_MINUTES = 60;
const MAX_INTERVAL_MINUTES = 20160; // 14 days
/** Backoff ceiling: repeated failures never push a subject out past this. */
const MAX_BACKOFF_MULTIPLIER = 8;

function clampInterval(minutes: number | undefined): number {
  if (minutes === undefined || !Number.isFinite(minutes)) return 1440;
  return Math.min(MAX_INTERVAL_MINUTES, Math.max(MIN_INTERVAL_MINUTES, Math.round(minutes)));
}

/** Explicitly enroll one subject. Idempotent on subjectRef. */
export async function enrollSubject(input: EnrollInput): Promise<{ enrolled: boolean }> {
  try {
    const intervalMinutes = clampInterval(input.intervalMinutes);
    await prisma.agentSubjectSchedule.upsert({
      where: { subjectRef: input.subjectRef },
      create: {
        id: randomUUID(),
        subjectRef: input.subjectRef,
        npi: input.npi ?? null,
        intervalMinutes,
        nextDueAt: input.firstDueAt ?? new Date(),
      },
      update: {
        enabled: true,
        intervalMinutes,
        ...(input.npi ? { npi: input.npi } : {}),
      },
    });
    return { enrolled: true };
  } catch {
    return { enrolled: false };
  }
}

/** Pause a subject without forgetting them. */
export async function setSubjectEnabled(
  subjectRef: string,
  enabled: boolean,
): Promise<{ updated: boolean }> {
  try {
    await prisma.agentSubjectSchedule.update({ where: { subjectRef }, data: { enabled } });
    return { updated: true };
  } catch {
    return { updated: false };
  }
}

/**
 * Claim up to `limit` due subjects for this tick.
 *
 * Candidates are read first, then each is claimed individually with a
 * compare-and-set. Reading a candidate proves nothing — only the update
 * winning proves this tick owns the subject.
 */
export async function claimDueSubjects(input: {
  limit: number;
  now: Date;
}): Promise<ScheduledSubject[]> {
  const candidates = await prisma.agentSubjectSchedule.findMany({
    where: { enabled: true, nextDueAt: { lte: input.now } },
    orderBy: { nextDueAt: 'asc' },
    take: Math.max(1, input.limit),
  });

  const claimed: ScheduledSubject[] = [];
  for (const candidate of candidates) {
    // Backoff scales the next due time with consecutive failures so a subject
    // that keeps failing stops consuming a slot every cycle.
    const multiplier = Math.min(MAX_BACKOFF_MULTIPLIER, 2 ** candidate.consecutiveFailures);
    const nextDueAt = new Date(
      input.now.getTime() + candidate.intervalMinutes * multiplier * 60_000,
    );

    const result = await prisma.agentSubjectSchedule.updateMany({
      // The `nextDueAt` predicate is the compare half of the CAS: if another
      // tick already claimed this row, its due time has moved and this
      // update matches nothing.
      where: { id: candidate.id, enabled: true, nextDueAt: { lte: input.now } },
      data: { nextDueAt, lastClaimedAt: input.now },
    });
    if (result.count !== 1) continue;

    claimed.push({
      id: candidate.id,
      subjectRef: candidate.subjectRef,
      npi: candidate.npi,
      intervalMinutes: candidate.intervalMinutes,
      consecutiveFailures: candidate.consecutiveFailures,
    });
  }
  return claimed;
}

/** Record a successful run against a claimed subject. */
export async function recordSubjectSuccess(input: {
  id: string;
  runId: string | null;
  now: Date;
}): Promise<void> {
  try {
    await prisma.agentSubjectSchedule.update({
      where: { id: input.id },
      data: {
        lastRunAt: input.now,
        lastRunId: input.runId,
        consecutiveFailures: 0,
        lastError: null,
      },
    });
  } catch {
    // Bookkeeping is best-effort; the claim already moved the due time, so a
    // lost update costs one cycle rather than correctness.
  }
}

/** Record a failed run. The claim already moved the due time. */
export async function recordSubjectFailure(input: {
  id: string;
  error: string;
  now: Date;
}): Promise<void> {
  try {
    await prisma.agentSubjectSchedule.update({
      where: { id: input.id },
      data: {
        lastRunAt: input.now,
        consecutiveFailures: { increment: 1 },
        lastError: input.error.slice(0, 500),
      },
    });
  } catch {
    /* best-effort */
  }
}

/** Operator view: how many subjects are enrolled, enabled, and due. */
export async function scheduleSummary(now: Date): Promise<{
  enrolled: number;
  enabled: number;
  due: number;
}> {
  const [enrolled, enabled, due] = await Promise.all([
    prisma.agentSubjectSchedule.count(),
    prisma.agentSubjectSchedule.count({ where: { enabled: true } }),
    prisma.agentSubjectSchedule.count({ where: { enabled: true, nextDueAt: { lte: now } } }),
  ]);
  return { enrolled, enabled, due };
}
