import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface DailyMetricCounts {
  applications: number;
  privilegesGranted: number;
  verifications: number;
  payerEnrollments: number;
  ehrFetches: number;
  vcsIssued: number;
}

export type AnalyticsPrisma = Pick<
  PrismaClient,
  | 'application'
  | 'privilegeGranted'
  | 'payerEnrollment'
  | 'analyticsEvent'
  | 'ehrFacadeAudit'
  | 'analyticsDailyRollup'
>;

const METRIC_FIELDS: (keyof DailyMetricCounts)[] = [
  'applications',
  'privilegesGranted',
  'verifications',
  'payerEnrollments',
  'ehrFetches',
  'vcsIssued',
];

function createEmptyCounts(): DailyMetricCounts {
  return {
    applications: 0,
    privilegesGranted: 0,
    verifications: 0,
    payerEnrollments: 0,
    ehrFetches: 0,
    vcsIssued: 0,
  };
}

function ensureEntry(
  counts: Map<string | null, DailyMetricCounts>,
  orgId: string | null
): DailyMetricCounts {
  if (!counts.has(orgId)) {
    counts.set(orgId, createEmptyCounts());
  }
  return counts.get(orgId)!;
}

function bumpMetric(
  counts: Map<string | null, DailyMetricCounts>,
  orgId: string | null,
  field: keyof DailyMetricCounts,
  amount = 1
): void {
  const bucket = ensureEntry(counts, orgId);
  bucket[field] += amount;

  if (orgId !== null) {
    const globalBucket = ensureEntry(counts, null);
    globalBucket[field] += amount;
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getDayBounds(date: Date): { start: Date; end: Date } {
  const start = startOfUtcDay(date);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function runDailyAnalyticsRollup(
  targetDate: Date = new Date(),
  client: AnalyticsPrisma = prisma
): Promise<void> {
  const { start, end } = getDayBounds(targetDate);
  const dateLabel = start.toISOString().slice(0, 10);
  const counts = new Map<string | null, DailyMetricCounts>();
  ensureEntry(counts, null);

  const [applications, privileges, enrollments, ehrFetches, verifications, vcsEvents] = await Promise.all([
    client.application.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      include: {
        job: {
          select: {
            partnerId: true,
          },
        },
      },
    }),
    client.privilegeGranted.findMany({
      where: {
        grantedAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        orgId: true,
      },
    }),
    client.payerEnrollment.findMany({
      where: {
        submittedAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        orgId: true,
      },
    }),
    client.ehrFacadeAudit.findMany({
      where: {
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: {
        orgId: true,
      },
    }),
    client.analyticsEvent.findMany({
      where: {
        eventType: 'PsvCompleted',
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      select: {
        orgId: true,
      },
    }),
    client.analyticsEvent.findMany({
      where: {
        eventType: 'PrivilegeApproved',
        timestamp: {
          gte: start,
          lt: end,
        },
      },
      select: {
        orgId: true,
      },
    }),
  ]);

  applications.forEach((app) => {
    const orgId = app.job?.partnerId ?? null;
    bumpMetric(counts, orgId, 'applications');
  });

  privileges.forEach((row) => {
    bumpMetric(counts, row.orgId ?? null, 'privilegesGranted');
    bumpMetric(counts, row.orgId ?? null, 'vcsIssued');
  });

  enrollments.forEach((row) => {
    bumpMetric(counts, row.orgId ?? null, 'payerEnrollments');
  });

  ehrFetches.forEach((row) => {
    bumpMetric(counts, row.orgId ?? null, 'ehrFetches');
  });

  verifications.forEach((row) => {
    bumpMetric(counts, row.orgId ?? null, 'verifications');
  });

  vcsEvents.forEach((row) => {
    bumpMetric(counts, row.orgId ?? null, 'vcsIssued');
  });

  const computedAt = new Date().toISOString();
  const upserts = Array.from(counts.entries()).map(([orgId, data]) =>
    client.analyticsDailyRollup.upsert({
      where: {
        date_orgId: {
          date: start,
          orgId,
        },
      },
      update: {
        ...data,
        metadata: {
          computedAt,
        },
      },
      create: {
        date: start,
        orgId,
        ...data,
        metadata: {
          computedAt,
        },
      },
    })
  );

  await Promise.all(upserts);

  const globalCounts = counts.get(null) ?? createEmptyCounts();
  const orgCount = counts.size - 1 >= 0 ? counts.size - 1 : 0;
  console.log(
    `📈 [AnalyticsRollup] ${dateLabel} | orgs=${orgCount} | apps=${globalCounts.applications} | privileges=${globalCounts.privilegesGranted} | verifications=${globalCounts.verifications}`
  );
}

export function startAnalyticsRollupCron(): void {
  const cronSchedule = process.env.ANALYTICS_ROLLUP_CRON_SCHEDULE || '15 3 * * *';
  console.log(`⏱️ [AnalyticsRollup] Starting cron with schedule ${cronSchedule}`);

  cron.schedule(cronSchedule, async () => {
    try {
      await runDailyAnalyticsRollup();
    } catch (error) {
      console.error('[AnalyticsRollup] Cron run failed:', error);
    }
  });
}

export default {
  runDailyAnalyticsRollup,
  startAnalyticsRollupCron,
};

if (require.main === module) {
  console.log('🚀 [AnalyticsRollup] Running in standalone mode...');
  startAnalyticsRollupCron();
  process.on('SIGINT', () => {
    console.log('\n🛑 [AnalyticsRollup] Shutting down...');
    process.exit(0);
  });
}

