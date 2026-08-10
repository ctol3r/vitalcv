/**
 * Agent cohort enrolment — the deliberate act.
 *
 * Row existence in `agent_subject_schedules` IS the cohort allowlist (A2 §15
 * Q7): no predicate can widen it, no dashboard button exists on purpose, and
 * this script is the intended enrolment path. Running it against production
 * is a founder decision, one subject at a time.
 *
 *   cd apps/web
 *   DATABASE_URL="<postgres url>" node scripts/agent/enroll-subject.mjs \
 *     --subject-ref user_2abc... [--npi 1234567890] [--interval-minutes 1440] \
 *     --commit
 *
 * Without --commit it is a dry run: it prints exactly what it would write and
 * whether the subject is already enrolled, and touches nothing. `subjectRef`
 * is the Clerk USER id (`user_...`), the same person-key the A0 start-plan
 * route writes — never an email, never an NPI, never the internal uuid.
 *
 * Mirrors lib/agent/schedule/subject-schedule.ts enrollSubject exactly
 * (upsert; re-running re-enables a paused row). Standalone because the lib
 * imports the Next server-only prisma singleton.
 */
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../lib/generated/prisma/client.js';

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  return idx > -1 ? process.argv[idx + 1] : undefined;
}
const has = (name) => process.argv.includes(`--${name}`);

const subjectRef = arg('subject-ref');
const npi = arg('npi');
const intervalRaw = arg('interval-minutes');
const commit = has('commit');

if (!subjectRef || !subjectRef.startsWith('user_')) {
  console.error(
    'A --subject-ref beginning with "user_" (the Clerk user id) is required.\n' +
      'This is deliberate: enrolment is per-person and explicit — no lists, no predicates.',
  );
  process.exit(1);
}
if (npi && !/^\d{10}$/.test(npi)) {
  console.error('--npi must be exactly 10 digits when provided.');
  process.exit(1);
}

// Same clamp as the lib: 60 min .. 14 days, default daily.
const intervalMinutes = Math.min(
  20160,
  Math.max(60, Math.round(Number(intervalRaw ?? 1440)) || 1440),
);

const dbUrl = process.env.DATABASE_URL ?? '';
if (!dbUrl || dbUrl.includes('placeholder')) {
  console.error('DATABASE_URL is unset or a placeholder. Refusing.');
  process.exit(1);
}
// Show the operator which database this will touch — host only, never creds.
const host = (() => {
  try {
    return new URL(dbUrl).host;
  } catch {
    return '(unparseable)';
  }
})();

const prisma = new PrismaClient();

try {
  const existing = await prisma.agentSubjectSchedule.findUnique({
    where: { subjectRef },
  });

  console.log(`target database : ${host}`);
  console.log(`subjectRef      : ${subjectRef}`);
  console.log(`npi             : ${npi ?? '(none)'}`);
  console.log(`intervalMinutes : ${intervalMinutes}`);
  console.log(
    existing
      ? `existing row    : enrolled ${existing.createdAt.toISOString()}, enabled=${existing.enabled} — commit RE-ENABLES and updates cadence`
      : 'existing row    : none — commit CREATES the row (this is the enrolment)',
  );

  if (!commit) {
    console.log('\nDRY RUN — nothing written. Re-run with --commit to enrol.');
    process.exit(0);
  }

  await prisma.agentSubjectSchedule.upsert({
    where: { subjectRef },
    create: {
      id: randomUUID(),
      subjectRef,
      npi: npi ?? null,
      intervalMinutes,
      nextDueAt: new Date(),
    },
    update: {
      enabled: true,
      intervalMinutes,
      ...(npi ? { npi } : {}),
    },
  });

  const row = await prisma.agentSubjectSchedule.findUnique({ where: { subjectRef } });
  console.log('\nENROLLED — row as persisted:');
  console.log(
    JSON.stringify(
      {
        subjectRef: row.subjectRef,
        enabled: row.enabled,
        intervalMinutes: row.intervalMinutes,
        nextDueAt: row.nextDueAt.toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(
    '\nThe hourly tick (agent-tick.yml, :25 past the hour) will claim this subject on its next run.\n' +
      'Watch it at /admin/agent-ops — loopState should leave not_enrolled.',
  );
} finally {
  await prisma.$disconnect();
}
