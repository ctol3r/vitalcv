import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

interface AdminRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

function requireAdmin(req: Request, res: Response, next: () => void) {
  const adminReq = req as AdminRequest;
  const roles = adminReq.user?.roles || [];
  const isAdmin = roles.includes('admin') || roles.includes('ADMIN');

  if (!adminReq.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!isAdmin) {
    return res.status(403).json({
      error: 'Insufficient permissions',
      message: 'Admin role required',
    });
  }

  return next();
}

interface MetricFields {
  applications: number;
  privilegesGranted: number;
  verifications: number;
  payerEnrollments: number;
  ehrFetches: number;
  vcsIssued: number;
}

const METRIC_KEYS: Array<keyof MetricFields> = [
  'applications',
  'privilegesGranted',
  'verifications',
  'payerEnrollments',
  'ehrFetches',
  'vcsIssued',
];

function emptyMetrics(): MetricFields {
  return {
    applications: 0,
    privilegesGranted: 0,
    verifications: 0,
    payerEnrollments: 0,
    ehrFetches: 0,
    vcsIssued: 0,
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

router.get('/summary/v2', requireAdmin, async (req: Request, res: Response) => {
  try {
    const rawDays = Number.parseInt(req.query.days as string, 10);
    const days = Number.isFinite(rawDays) ? Math.min(Math.max(rawDays, 1), 90) : 14;
    const orgId = typeof req.query.orgId === 'string' && req.query.orgId.trim().length > 0 ? req.query.orgId.trim() : undefined;
    const scope: 'global' | 'org' = orgId ? 'org' : 'global';

    const today = startOfUtcDay(new Date());
    const windowStart = new Date(today);
    windowStart.setUTCDate(windowStart.getUTCDate() - (days - 1));
    const windowEnd = new Date(today);
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1); // exclusive

    const [scopedRows, orgRows, orgProfile] = await Promise.all([
      prisma.analyticsDailyRollup.findMany({
        where: {
          date: { gte: windowStart, lt: windowEnd },
          orgId: scope === 'global' ? null : orgId,
        },
        orderBy: { date: 'asc' },
      }),
      prisma.analyticsDailyRollup.findMany({
        where: {
          date: { gte: windowStart, lt: windowEnd },
          orgId: { not: null },
        },
      }),
      scope === 'org' && orgId
        ? prisma.orgProfile.findUnique({
            where: { orgId },
            select: { name: true },
          })
        : null,
    ]);

    const dayKey = (date: Date) => date.toISOString().slice(0, 10);
    const rowByDate = new Map<string, typeof scopedRows[number]>();
    scopedRows.forEach((row) => {
      rowByDate.set(dayKey(row.date), row);
    });

    const daily = Array.from({ length: days }).map((_, index) => {
      const current = new Date(windowStart);
      current.setUTCDate(windowStart.getUTCDate() + index);
      const key = dayKey(current);
      const row = rowByDate.get(key);

      return {
        date: key,
        applications: row?.applications ?? 0,
        privilegesGranted: row?.privilegesGranted ?? 0,
        verifications: row?.verifications ?? 0,
        payerEnrollments: row?.payerEnrollments ?? 0,
        ehrFetches: row?.ehrFetches ?? 0,
        vcsIssued: row?.vcsIssued ?? 0,
      };
    });

    const totals = daily.reduce<MetricFields>((acc, day) => {
      METRIC_KEYS.forEach((key) => {
        acc[key] += day[key];
      });
      return acc;
    }, emptyMetrics());

    const lastUpdated = scopedRows.reduce<Date | null>((latest, row) => {
      if (!latest || row.updatedAt > latest) {
        return row.updatedAt;
      }
      return latest;
    }, null);

    const orgTotals = new Map<
      string,
      MetricFields & {
        orgName: string;
      }
    >();

    orgRows.forEach((row) => {
      if (!row.orgId) return;
      if (!orgTotals.has(row.orgId)) {
        orgTotals.set(row.orgId, {
          ...emptyMetrics(),
          orgName: row.orgId,
        });
      }
      const tracker = orgTotals.get(row.orgId)!;
      METRIC_KEYS.forEach((key) => {
        tracker[key] += row[key];
      });
    });

    if (orgTotals.size > 0) {
      const orgIds = Array.from(orgTotals.keys());
      const profiles = await prisma.orgProfile.findMany({
        where: { orgId: { in: orgIds } },
        select: { orgId: true, name: true },
      });
      const nameMap = new Map(profiles.map((profile) => [profile.orgId, profile.name]));
      orgTotals.forEach((value, key) => {
        value.orgName = nameMap.get(key) ?? key;
      });
    }

    const orgBreakdown = Array.from(orgTotals.entries())
      .map(([orgKey, metrics]) => ({
        orgId: orgKey,
        orgName: metrics.orgName,
        applications: metrics.applications,
        privilegesGranted: metrics.privilegesGranted,
        verifications: metrics.verifications,
        payerEnrollments: metrics.payerEnrollments,
        ehrFetches: metrics.ehrFetches,
        vcsIssued: metrics.vcsIssued,
        total:
          metrics.applications +
          metrics.privilegesGranted +
          metrics.verifications +
          metrics.payerEnrollments +
          metrics.vcsIssued,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8)
      .map(({ total, ...rest }) => rest);

    return res.json({
      scope,
      orgId,
      orgName: scope === 'org' ? orgProfile?.name ?? null : null,
      days,
      totals,
      daily,
      orgBreakdown,
      lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
    });
  } catch (error) {
    console.error('[ExecSummaryV2] Failed to build analytics summary:', error);
    return res.status(500).json({
      error: 'failed_to_build_summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const DEFAULT_DAYS = 14;
const MIN_DAYS = 7;
const MAX_DAYS = 90;
const BREAKDOWN_LIMIT = 10;

type MetricFields = {
  applications: number;
  privilegesGranted: number;
  verifications: number;
  payerEnrollments: number;
  ehrFetches: number;
  vcsIssued: number;
};

function clampDays(value?: string | string[]): number {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return DEFAULT_DAYS;
  }
  return Math.min(MAX_DAYS, Math.max(MIN_DAYS, Math.floor(parsed)));
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function toDateKey(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function addMetrics(target: MetricFields, source: MetricFields): void {
  (Object.keys(target) as (keyof MetricFields)[]).forEach((field) => {
    target[field] += source[field];
  });
}

function emptyMetrics(): MetricFields {
  return {
    applications: 0,
    privilegesGranted: 0,
    verifications: 0,
    payerEnrollments: 0,
    ehrFetches: 0,
    vcsIssued: 0,
  };
}

router.get(
  '/summary/v2',
  async (req: Request<{}, {}, {}, { orgId?: string; days?: string }>, res: Response) => {
    try {
      const days = clampDays(req.query.days);
      const requestedOrgId = req.query.orgId?.trim();
      const scopeOrgId = requestedOrgId && requestedOrgId !== 'global' ? requestedOrgId : null;

      const today = startOfUtcDay(new Date());
      const startDate = new Date(today);
      startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

      const rollups = await prisma.analyticsDailyRollup.findMany({
        where: {
          orgId: scopeOrgId,
          date: {
            gte: startDate,
            lte: today,
          },
        },
        orderBy: {
          date: 'asc',
        },
      });

      const dailyMap = new Map<string, MetricFields>();
      rollups.forEach((row) => {
        dailyMap.set(row.date.toISOString().slice(0, 10), {
          applications: row.applications,
          privilegesGranted: row.privilegesGranted,
          verifications: row.verifications,
          payerEnrollments: row.payerEnrollments,
          ehrFetches: row.ehrFetches,
          vcsIssued: row.vcsIssued,
        });
      });

      const dailySeries: Array<MetricFields & { date: string }> = [];
      const totals = emptyMetrics();
      for (let i = 0; i < days; i += 1) {
        const current = new Date(startDate);
        current.setUTCDate(startDate.getUTCDate() + i);
        const key = toDateKey(current);
        const metrics = dailyMap.get(key) ?? emptyMetrics();
        dailySeries.push({
          date: key,
          ...metrics,
        });
        addMetrics(totals, { ...metrics });
      }

      const lastUpdated = rollups.length > 0
        ? rollups.reduce<Date | null>((latest, row) => {
            if (!latest || row.updatedAt > latest) {
              return row.updatedAt;
            }
            return latest;
          }, null)
        : null;

      let orgBreakdown: Array<MetricFields & { orgId: string; orgName: string }> = [];
      if (scopeOrgId) {
        const orgName = await prisma.partnerConfig.findFirst({
          where: { partnerId: scopeOrgId },
          select: { partnerName: true },
        });
        orgBreakdown = [
          {
            orgId: scopeOrgId,
            orgName: orgName?.partnerName || scopeOrgId,
            ...totals,
          },
        ];
      } else {
        const orgRows = await prisma.analyticsDailyRollup.findMany({
          where: {
            orgId: {
              not: null,
            },
            date: {
              gte: startDate,
              lte: today,
            },
          },
        });

        const perOrg = new Map<string, MetricFields>();
        orgRows.forEach((row) => {
          const orgId = row.orgId!;
          if (!perOrg.has(orgId)) {
            perOrg.set(orgId, emptyMetrics());
          }
          const bucket = perOrg.get(orgId)!;
          addMetrics(bucket, {
            applications: row.applications,
            privilegesGranted: row.privilegesGranted,
            verifications: row.verifications,
            payerEnrollments: row.payerEnrollments,
            ehrFetches: row.ehrFetches,
            vcsIssued: row.vcsIssued,
          });
        });

        const orgIds = Array.from(perOrg.keys());
        const partnerNames = await prisma.partnerConfig.findMany({
          where: {
            partnerId: {
              in: orgIds,
            },
          },
          select: {
            partnerId: true,
            partnerName: true,
          },
        });
        const nameMap = new Map(partnerNames.map((p) => [p.partnerId, p.partnerName]));

        orgBreakdown = Array.from(perOrg.entries())
          .map(([orgId, metrics]) => ({
            orgId,
            orgName: nameMap.get(orgId) || orgId,
            ...metrics,
            activityScore:
              metrics.applications +
              metrics.privilegesGranted +
              metrics.verifications +
              metrics.payerEnrollments +
              metrics.vcsIssued,
          }))
          .sort((a, b) => b.activityScore - a.activityScore)
          .slice(0, BREAKDOWN_LIMIT)
          .map(({ activityScore, ...rest }) => rest);
      }

      res.json({
        scope: scopeOrgId ? 'org' : 'global',
        orgId: scopeOrgId ?? undefined,
        days,
        totals,
        daily: dailySeries,
        orgBreakdown,
        lastUpdated: lastUpdated?.toISOString() ?? null,
      });
    } catch (error) {
      console.error('[ExecSummaryV2] Failed to fetch metrics:', error);
      res.status(500).json({
        error: 'Failed to fetch executive summary metrics',
      });
    }
  }
);

export default router;

