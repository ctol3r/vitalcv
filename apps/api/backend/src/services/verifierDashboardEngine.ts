/**
 * Verifier Dashboard Engine — Wave Z
 *
 * Aggregates credential metrics per organization for the pilot
 * verifier dashboard. All queries are tenant-scoped.
 *
 * Summary dimensions:
 *   - totalCredentials
 *   - activeCount / suspendedCount / revokedCount
 *   - expiringSoonCount (within 60 days)
 *   - psvWindowBreaches
 *   - avgDaysToVerification / avgDaysSaved
 *
 * Deterministic. No randomness. No external SaaS.
 */

import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { computeRevenueSignal, type OnboardingMetrics } from './revenueSignalEngine';
import { getIntegrationHealth } from './externalIntegrations';

/** Stub: onboardingAnalyticsEngine was removed. Returns empty defaults. */
async function getOnboardingMetrics(_organizationId: string): Promise<OnboardingMetrics> {
  return {
    avgDaysToVerification: null,
    avgDaysToPSVCompletion: null,
    totalArtifacts: 0,
    completedVerifications: 0,
    completedPSV: 0,
  };
}

/** Stub: failureIsolationEngine was removed. Returns healthy defaults. */
async function getObservabilityStatus(): Promise<{ systemHealthy: boolean; recentCriticalFailures: number }> {
  return { systemHealthy: true, recentCriticalFailures: 0 };
}

// ── Types ───────────────────────────────────────────────────

export type DashboardSummary = {
  totalCredentials: number;
  activeCount: number;
  suspendedCount: number;
  revokedCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  psvWindowBreaches: number;
  avgDaysToVerification: number | null;
  avgDaysSaved: number | null;
};

export type DashboardResponse = {
  organizationId: string;
  summary: DashboardSummary;
  recentTransparencyEvents: TransparencyEventSummary[];
  recentMonitoringEvents: MonitoringEventSummary[];
  revenueImpact: {
    avgDaysSaved: number | null;
    estimatedRevenueRecovered: number | null;
    completedPSV: number;
  };
  systemHealth: {
    systemHealthy: boolean;
    integrationHealthy: boolean;
    recentCriticalFailures: number;
  };
  generatedAt: string;
};

export type DashboardExport = {
  organizationId: string;
  generatedAt: string;
  summary: DashboardSummary;
  lifecycleStats: {
    activeCount: number;
    suspendedCount: number;
    revokedCount: number;
    expiredCount: number;
  };
  monitoringStats: {
    recentEventCount: number;
    deltaDetectedCount: number;
    expirationWarningCount: number;
  };
  psvComplianceStats: {
    totalPSVWindows: number;
    compliantCount: number;
    breachCount: number;
    pendingCount: number;
  };
  revenueImpact: {
    avgDaysSaved: number | null;
    estimatedRevenueRecovered: number | null;
    completedPSV: number;
  };
};

type TransparencyEventSummary = {
  artifactId: string;
  lifecycleState: string;
  createdAt: string;
};

type MonitoringEventSummary = {
  artifactId: string;
  eventType: string;
  createdAt: string;
};

// ── Constants ───────────────────────────────────────────────

const EXPIRING_SOON_DAYS = 60;
const MS_PER_DAY = 86_400_000;
const BASELINE_DAYS = 120;
const RECENT_EVENTS_LIMIT = 20;

// ── Helpers ─────────────────────────────────────────────────

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * MS_PER_DAY);
}

// ── Summary aggregation ─────────────────────────────────────

export async function getDashboardSummary(
  organizationId: string,
): Promise<DashboardSummary> {
  const now = new Date();
  const expirationCutoff = daysFromNow(EXPIRING_SOON_DAYS);

  const [
    totalCredentials,
    activeCount,
    suspendedCount,
    revokedCount,
    expiredCount,
    expiringSoonCount,
    psvWindowBreaches,
  ] = await Promise.all([
    prisma.verificationArtifact.count({
      where: { organizationId },
    }),
    prisma.verificationArtifact.count({
      where: { organizationId, lifecycleState: 'ACTIVE' },
    }),
    prisma.verificationArtifact.count({
      where: { organizationId, lifecycleState: 'SUSPENDED' },
    }),
    prisma.verificationArtifact.count({
      where: { organizationId, lifecycleState: 'REVOKED' },
    }),
    prisma.verificationArtifact.count({
      where: { organizationId, lifecycleState: 'EXPIRED' },
    }),
    prisma.verificationArtifact.count({
      where: {
        organizationId,
        lifecycleState: 'ACTIVE',
        expiresAt: { not: null, gt: now, lte: expirationCutoff },
      },
    }),
    prisma.verificationArtifact.count({
      where: {
        organizationId,
        psvWindowCompliant: false,
      },
    }),
  ]);

  // Compute average days to verification and average days saved
  const onboardingMetrics = await getOnboardingMetrics(organizationId);
  const avgDaysToVerification = onboardingMetrics.avgDaysToVerification;
  const avgDaysSaved = onboardingMetrics.avgDaysToPSVCompletion !== null
    ? Math.max(0, BASELINE_DAYS - onboardingMetrics.avgDaysToPSVCompletion)
    : null;

  return {
    totalCredentials,
    activeCount,
    suspendedCount,
    revokedCount,
    expiredCount,
    expiringSoonCount,
    psvWindowBreaches,
    avgDaysToVerification,
    avgDaysSaved,
  };
}

// ── Full dashboard response ─────────────────────────────────

export async function buildDashboardResponse(
  organizationId: string,
): Promise<DashboardResponse> {
  const [
    summary,
    recentTransparency,
    recentMonitoring,
    onboardingMetrics,
    observability,
    integrationHealth,
  ] = await Promise.all([
    getDashboardSummary(organizationId),
    prisma.credentialTransparencyLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_EVENTS_LIMIT,
      select: { artifactId: true, lifecycleState: true, createdAt: true },
    }),
    prisma.credentialMonitoringEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_EVENTS_LIMIT,
      select: { artifactId: true, eventType: true, createdAt: true },
    }),
    getOnboardingMetrics(organizationId),
    getObservabilityStatus(),
    getIntegrationHealth(),
  ]);

  const revenueSignal = computeRevenueSignal(onboardingMetrics);

  const response: DashboardResponse = {
    organizationId,
    summary,
    recentTransparencyEvents: recentTransparency.map((e) => ({
      artifactId: e.artifactId,
      lifecycleState: e.lifecycleState,
      createdAt: e.createdAt.toISOString(),
    })),
    recentMonitoringEvents: recentMonitoring.map((e) => ({
      artifactId: e.artifactId,
      eventType: e.eventType,
      createdAt: e.createdAt.toISOString(),
    })),
    revenueImpact: {
      avgDaysSaved: revenueSignal.avgDaysSaved,
      estimatedRevenueRecovered: revenueSignal.estimatedRevenueRecovered,
      completedPSV: revenueSignal.completedPSV,
    },
    systemHealth: {
      systemHealthy: observability.systemHealthy,
      integrationHealthy: integrationHealth.healthy,
      recentCriticalFailures: observability.recentCriticalFailures,
    },
    generatedAt: new Date().toISOString(),
  };

  log('info', 'verifier_dashboard_built', {
    event: 'verifier_dashboard_built',
    organizationId,
    totalCredentials: summary.totalCredentials,
  });

  return response;
}

// ── Audit-ready export ──────────────────────────────────────

export async function buildDashboardExport(
  organizationId: string,
): Promise<DashboardExport> {
  const [summary, monitoringEvents, psvStats, onboardingMetrics] = await Promise.all([
    getDashboardSummary(organizationId),
    prisma.credentialMonitoringEvent.findMany({
      where: { organizationId },
      select: { eventType: true },
    }),
    prisma.verificationArtifact.findMany({
      where: {
        organizationId,
        psvWindowDeadline: { not: null },
      },
      select: { psvWindowCompliant: true },
    }),
    getOnboardingMetrics(organizationId),
  ]);

  const revenueSignal = computeRevenueSignal(onboardingMetrics);

  const deltaDetectedCount = monitoringEvents.filter(
    (e) => e.eventType === 'delta-detected',
  ).length;
  const expirationWarningCount = monitoringEvents.filter(
    (e) => e.eventType === 'expiration-warning',
  ).length;

  const compliantCount = psvStats.filter((a) => a.psvWindowCompliant === true).length;
  const breachCount = psvStats.filter((a) => a.psvWindowCompliant === false).length;
  const pendingCount = psvStats.filter((a) => a.psvWindowCompliant === null).length;

  log('info', 'verifier_dashboard_export_built', {
    event: 'verifier_dashboard_export_built',
    organizationId,
  });

  return {
    organizationId,
    generatedAt: new Date().toISOString(),
    summary,
    lifecycleStats: {
      activeCount: summary.activeCount,
      suspendedCount: summary.suspendedCount,
      revokedCount: summary.revokedCount,
      expiredCount: summary.expiredCount,
    },
    monitoringStats: {
      recentEventCount: monitoringEvents.length,
      deltaDetectedCount,
      expirationWarningCount,
    },
    psvComplianceStats: {
      totalPSVWindows: psvStats.length,
      compliantCount,
      breachCount,
      pendingCount,
    },
    revenueImpact: {
      avgDaysSaved: revenueSignal.avgDaysSaved,
      estimatedRevenueRecovered: revenueSignal.estimatedRevenueRecovered,
      completedPSV: revenueSignal.completedPSV,
    },
  };
}
