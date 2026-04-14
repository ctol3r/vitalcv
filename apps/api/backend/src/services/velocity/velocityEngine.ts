// @ts-nocheck
/**
 * velocityEngine.ts — Wave 250
 *
 * Computes public system velocity and authenticated organization drilldown
 * metrics from persisted trust-state snapshots and attested start data.
 */

import prisma from '../../graphql/prisma_client';

const INDUSTRY_AVG_DAYS = 94;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const TRAILING_MONTHS = 12;

export type VelocityScope = 'system' | 'organization';
export type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';

export type TrendPoint = {
  month: string;
  avgDays: number | null;
  sampleSize: number;
};

export type DistributionPoint = {
  band: TrustBand;
  count: number;
  rate: number;
};

export type CountPoint = {
  month: string;
  count: number;
};

export type StartAccelerationPoint = {
  month: string;
  avgDays: number | null;
  daysSaved: number | null;
  sampleSize: number;
};

export type VelocitySummary = {
  scope: VelocityScope;
  avgTimeToStartDays: number | null;
  timeToStartSampleSize: number;
  insufficientDataReason?: string;
  industryAvgDays: number;
  compressionRatio: number | null;
  credentialReadinessRate: number;
  monitoringCoverageRate: number;
  verificationReuseRate: number;
  totalApplications: number;
  totalAccepted: number;
  totalDecisionCapsules: number;
  trend: TrendPoint[];
  readinessDistribution: DistributionPoint[];
  verificationReuseEvents: CountPoint[];
  monitoringAlerts: CountPoint[];
  startAccelerationEstimates: StartAccelerationPoint[];
  computedAt: string;
};

export type OrganizationVelocityDashboard = VelocitySummary & {
  scope: 'organization';
  organization: {
    organizationId: string;
    organizationName: string;
  };
  systemComparison: Pick<
    VelocitySummary,
    | 'avgTimeToStartDays'
    | 'timeToStartSampleSize'
    | 'credentialReadinessRate'
    | 'monitoringCoverageRate'
    | 'verificationReuseRate'
  >;
};

export type SystemVelocityDashboard = VelocitySummary & {
  scope: 'system';
};

type TrustSnapshotRecord = {
  npi: string;
  trustBand: TrustBand;
};

type CapsuleProjection = {
  decisionTimestamp: Date;
  credentialIds: string[];
  metadata: unknown;
};

type StartDeltaRecord = {
  acceptedAt: Date;
  startedAt: Date;
};

type OrganizationScope = {
  organizationId: string;
  organizationName: string;
  opportunityIds: string[];
  cohortNpis: string[];
  totalApplications: number;
  totalAccepted: number;
};

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

function monthKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function addUtcMonths(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1, 0, 0, 0, 0));
}

function trailingMonths(now: Date, count: number): string[] {
  const anchor = startOfUtcMonth(now);
  const months: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    months.push(monthKey(addUtcMonths(anchor, -offset)));
  }
  return months;
}

function msToDays(ms: number): number {
  return ms / MS_PER_DAY;
}

function roundDays(value: number): number {
  return Number(value.toFixed(2));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseTrustBand(value: unknown): TrustBand | null {
  return value === 'L0' || value === 'L1' || value === 'L2' || value === 'L3' ? value : null;
}

function extractTrustBandFromPayload(value: unknown): TrustBand | null {
  if (!isRecord(value)) {
    return null;
  }

  return parseTrustBand(value.readiness_level) ?? parseTrustBand(value.trustBand);
}

function buildDistribution(snapshotRecords: TrustSnapshotRecord[], denominator: number): DistributionPoint[] {
  const counts = new Map<TrustBand, number>([
    ['L0', 0],
    ['L1', 0],
    ['L2', 0],
    ['L3', 0],
  ]);

  for (const record of snapshotRecords) {
    counts.set(record.trustBand, (counts.get(record.trustBand) ?? 0) + 1);
  }

  return (['L0', 'L1', 'L2', 'L3'] as const).map((band) => ({
    band,
    count: counts.get(band) ?? 0,
    rate: safeRate(counts.get(band) ?? 0, denominator),
  }));
}

function buildTrendPoints(months: string[], deltaRecords: StartDeltaRecord[]): TrendPoint[] {
  const byMonth = new Map<string, { totalDays: number; sampleSize: number }>();

  for (const record of deltaRecords) {
    const key = monthKey(record.startedAt);
    if (!months.includes(key)) {
      continue;
    }

    const deltaDays = msToDays(record.startedAt.getTime() - record.acceptedAt.getTime());
    if (deltaDays < 0) {
      continue;
    }

    const existing = byMonth.get(key) ?? { totalDays: 0, sampleSize: 0 };
    existing.totalDays += deltaDays;
    existing.sampleSize += 1;
    byMonth.set(key, existing);
  }

  return months.map((month) => {
    const entry = byMonth.get(month);
    if (!entry || entry.sampleSize === 0) {
      return { month, avgDays: null, sampleSize: 0 };
    }

    return {
      month,
      avgDays: roundDays(entry.totalDays / entry.sampleSize),
      sampleSize: entry.sampleSize,
    };
  });
}

function buildStartAccelerationPoints(trend: TrendPoint[]): StartAccelerationPoint[] {
  return trend.map((point) => ({
    month: point.month,
    avgDays: point.avgDays,
    daysSaved: point.avgDays === null ? null : roundDays(INDUSTRY_AVG_DAYS - point.avgDays),
    sampleSize: point.sampleSize,
  }));
}

function buildMonthlyCounts(months: string[], rows: Array<{ createdAt: Date }>): CountPoint[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    const key = monthKey(row.createdAt);
    if (!months.includes(key)) {
      continue;
    }
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return months.map((month) => ({
    month,
    count: counts.get(month) ?? 0,
  }));
}

function parseCapsuleMetadata(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function scopeCapsulesToOrganization(
  capsules: CapsuleProjection[],
  organizationId: string,
  opportunityIds: Set<string>,
): CapsuleProjection[] {
  return capsules.filter((capsule) => {
    const metadata = parseCapsuleMetadata(capsule.metadata);
    if (!metadata) {
      return false;
    }

    if (metadata.organizationId === organizationId || metadata.employerId === organizationId) {
      return true;
    }

    return typeof metadata.opportunityId === 'string' && opportunityIds.has(metadata.opportunityId);
  });
}

function buildReuseRate(capsules: CapsuleProjection[]): {
  verificationReuseRate: number;
  totalDecisionCapsules: number;
  reuseEvents: Array<{ createdAt: Date }>;
} {
  const credentialUsage = new Map<string, number>();
  for (const capsule of capsules) {
    for (const credentialId of capsule.credentialIds) {
      credentialUsage.set(credentialId, (credentialUsage.get(credentialId) ?? 0) + 1);
    }
  }

  const reusedCredentialIds = new Set<string>();
  for (const [credentialId, count] of credentialUsage.entries()) {
    if (count > 1) {
      reusedCredentialIds.add(credentialId);
    }
  }

  const reuseEvents: Array<{ createdAt: Date }> = [];
  for (const capsule of capsules) {
    const hasReusedCredential = capsule.credentialIds.some((credentialId) => reusedCredentialIds.has(credentialId));
    if (hasReusedCredential) {
      reuseEvents.push({ createdAt: capsule.decisionTimestamp });
    }
  }

  return {
    verificationReuseRate: safeRate(reusedCredentialIds.size, credentialUsage.size),
    totalDecisionCapsules: capsules.length,
    reuseEvents,
  };
}

async function loadOrganizationScope(organizationId: string): Promise<OrganizationScope> {
  const opportunities = await prisma.opportunity.findMany({
    where: { organizationId },
    select: { id: true, organization: { select: { name: true } } },
  });

  const organizationName = opportunities[0]?.organization.name
    ?? (await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }))?.name
    ?? organizationId;

  const opportunityIds = opportunities.map((opportunity) => opportunity.id);

  const applications = await prisma.application.findMany({
    where: { opportunity: { organizationId } },
    select: { status: true, npi: true },
  });

  const cohortNpis = [...new Set(applications
    .map((application) => application.npi)
    .filter((npi): npi is string => typeof npi === 'string' && /^\d{10}$/.test(npi)))];

  return {
    organizationId,
    organizationName,
    opportunityIds,
    cohortNpis,
    totalApplications: applications.length,
    totalAccepted: applications.filter((application) => application.status === 'ACCEPTED').length,
  };
}

async function loadSystemScope(): Promise<OrganizationScope> {
  const applications = await prisma.application.findMany({
    select: {
      opportunityId: true,
      status: true,
      npi: true,
    },
  });

  return {
    organizationId: 'system',
    organizationName: 'System',
    opportunityIds: [...new Set(applications.map((application) => application.opportunityId))],
    cohortNpis: [...new Set(applications
      .map((application) => application.npi)
      .filter((npi): npi is string => typeof npi === 'string' && /^\d{10}$/.test(npi)))],
    totalApplications: applications.length,
    totalAccepted: applications.filter((application) => application.status === 'ACCEPTED').length,
  };
}

async function loadLatestTrustSnapshots(cohortNpis: string[]): Promise<TrustSnapshotRecord[]> {
  if (cohortNpis.length === 0) {
    return [];
  }

  const artifacts = await prisma.verificationArtifact.findMany({
    where: {
      npi: { in: cohortNpis },
      source: 'TRUST_STATE_ENGINE',
    },
    select: {
      npi: true,
      trustState: true,
      rawPayload: true,
      verifiedAt: true,
    },
    orderBy: [
      { npi: 'asc' },
      { verifiedAt: 'desc' },
    ],
  });

  const latestByNpi = new Map<string, TrustSnapshotRecord>();
  for (const artifact of artifacts) {
    if (latestByNpi.has(artifact.npi)) {
      continue;
    }

    const trustBand = parseTrustBand(artifact.trustState)
      ?? extractTrustBandFromPayload(artifact.rawPayload)
      ?? 'L0';

    latestByNpi.set(artifact.npi, {
      npi: artifact.npi,
      trustBand,
    });
  }

  return [...latestByNpi.values()];
}

async function loadMonitoringCoverage(cohortNpis: string[]): Promise<number> {
  if (cohortNpis.length === 0) {
    return 0;
  }

  const [monitored, total] = await Promise.all([
    prisma.verificationArtifact.count({
      where: {
        npi: { in: cohortNpis },
        source: { not: 'TRUST_STATE_ENGINE' },
        monitoring: true,
      },
    }),
    prisma.verificationArtifact.count({
      where: {
        npi: { in: cohortNpis },
        source: { not: 'TRUST_STATE_ENGINE' },
      },
    }),
  ]);

  return safeRate(monitored, total);
}

async function loadMonitoringAlerts(cohortNpis: string[], since: Date): Promise<Array<{ createdAt: Date }>> {
  if (cohortNpis.length === 0) {
    return [];
  }

  const alerts = await prisma.trustAlertRecord.findMany({
    where: {
      subject: { in: cohortNpis },
      createdAt: { gte: since },
    },
    select: { createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  return alerts;
}

async function loadDecisionCapsules(cohortNpis: string[]): Promise<CapsuleProjection[]> {
  if (cohortNpis.length === 0) {
    return [];
  }

  const capsules = await prisma.decisionCapsule.findMany({
    where: { subjectNpi: { in: cohortNpis } },
    select: {
      decisionTimestamp: true,
      credentialIds: true,
      metadata: true,
    },
    orderBy: { decisionTimestamp: 'desc' },
  });

  return capsules;
}

async function loadStartDeltaRecords(organizationId?: string): Promise<StartDeltaRecord[]> {
  const starts = await prisma.startAttestation.findMany({
    where: organizationId
      ? {
          acceptance: {
            employerId: organizationId,
          },
        }
      : undefined,
    select: {
      startedAt: true,
      acceptance: {
        select: {
          acceptedAt: true,
        },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  return starts
    .map((start) => ({
      acceptedAt: start.acceptance.acceptedAt,
      startedAt: start.startedAt,
    }))
    .filter((record) => record.startedAt.getTime() >= record.acceptedAt.getTime());
}

function buildTimeToStartSummary(records: StartDeltaRecord[]): Pick<
  VelocitySummary,
  'avgTimeToStartDays' | 'timeToStartSampleSize' | 'insufficientDataReason' | 'compressionRatio'
> {
  if (records.length === 0) {
    return {
      avgTimeToStartDays: null,
      timeToStartSampleSize: 0,
      insufficientDataReason: 'No attested employer starts found for this scope.',
      compressionRatio: null,
    };
  }

  const totalDays = records.reduce((sum, record) => (
    sum + msToDays(record.startedAt.getTime() - record.acceptedAt.getTime())
  ), 0);
  const avgTimeToStartDays = roundDays(totalDays / records.length);

  return {
    avgTimeToStartDays,
    timeToStartSampleSize: records.length,
    compressionRatio: avgTimeToStartDays > 0 ? roundDays(INDUSTRY_AVG_DAYS / avgTimeToStartDays) : null,
  };
}

async function computeSummary(scope: VelocityScope, organizationId?: string): Promise<VelocitySummary> {
  const computedAt = new Date().toISOString();
  const now = new Date();
  const monthLabels = trailingMonths(now, TRAILING_MONTHS);
  const earliestMonth = addUtcMonths(startOfUtcMonth(now), -(TRAILING_MONTHS - 1));

  const scoped = scope === 'organization' && organizationId
    ? await loadOrganizationScope(organizationId)
    : await loadSystemScope();

  const [
    latestSnapshots,
    monitoringCoverageRate,
    allCapsules,
    startDeltaRecords,
    alertRows,
  ] = await Promise.all([
    loadLatestTrustSnapshots(scoped.cohortNpis),
    loadMonitoringCoverage(scoped.cohortNpis),
    loadDecisionCapsules(scoped.cohortNpis),
    loadStartDeltaRecords(scope === 'organization' ? organizationId : undefined),
    loadMonitoringAlerts(scoped.cohortNpis, earliestMonth),
  ]);

  const scopedCapsules = scope === 'organization' && organizationId
    ? scopeCapsulesToOrganization(allCapsules, organizationId, new Set(scoped.opportunityIds))
    : allCapsules;

  const readinessDistribution = buildDistribution(latestSnapshots, scoped.cohortNpis.length);
  const readyCount = latestSnapshots.filter((snapshot) =>
    snapshot.trustBand === 'L2' || snapshot.trustBand === 'L3').length;

  const timeToStartSummary = buildTimeToStartSummary(startDeltaRecords);
  const trend = buildTrendPoints(monthLabels, startDeltaRecords.filter(
    (record) => record.startedAt.getTime() >= earliestMonth.getTime(),
  ));

  const reuse = buildReuseRate(scopedCapsules);

  return {
    scope,
    industryAvgDays: INDUSTRY_AVG_DAYS,
    avgTimeToStartDays: timeToStartSummary.avgTimeToStartDays,
    timeToStartSampleSize: timeToStartSummary.timeToStartSampleSize,
    compressionRatio: timeToStartSummary.compressionRatio,
    ...(timeToStartSummary.insufficientDataReason
      ? { insufficientDataReason: timeToStartSummary.insufficientDataReason }
      : {}),
    credentialReadinessRate: safeRate(readyCount, scoped.cohortNpis.length),
    monitoringCoverageRate,
    verificationReuseRate: reuse.verificationReuseRate,
    totalApplications: scoped.totalApplications,
    totalAccepted: scoped.totalAccepted,
    totalDecisionCapsules: reuse.totalDecisionCapsules,
    trend,
    readinessDistribution,
    verificationReuseEvents: buildMonthlyCounts(monthLabels, reuse.reuseEvents),
    monitoringAlerts: buildMonthlyCounts(monthLabels, alertRows),
    startAccelerationEstimates: buildStartAccelerationPoints(trend),
    computedAt,
  };
}

export async function computeVelocityMetrics(): Promise<SystemVelocityDashboard> {
  const summary = await computeSummary('system');
  return {
    ...summary,
    scope: 'system',
  };
}

export async function computeOrganizationVelocityMetrics(
  organizationId: string,
): Promise<OrganizationVelocityDashboard> {
  const [organizationScope, organizationSummary, systemSummary] = await Promise.all([
    loadOrganizationScope(organizationId),
    computeSummary('organization', organizationId),
    computeSummary('system'),
  ]);

  return {
    ...organizationSummary,
    scope: 'organization',
    organization: {
      organizationId,
      organizationName: organizationScope.organizationName,
    },
    systemComparison: {
      avgTimeToStartDays: systemSummary.avgTimeToStartDays,
      timeToStartSampleSize: systemSummary.timeToStartSampleSize,
      credentialReadinessRate: systemSummary.credentialReadinessRate,
      monitoringCoverageRate: systemSummary.monitoringCoverageRate,
      verificationReuseRate: systemSummary.verificationReuseRate,
    },
  };
}
