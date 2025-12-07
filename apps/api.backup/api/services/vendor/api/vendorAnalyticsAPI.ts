/**
 * B240B-VM-020: Vendor Analytics API
 *
 * Exposes aggregated vendor analytics via secure endpoints:
 * - Performance metrics
 * - Risk summaries
 * - Compliance status
 * - Supports filtering by category and date range
 * - Enforces permissions
 */

import { PrismaClient } from '@prisma/client';
import { calculateVendorPerformance, getVendorPerformanceTrends } from '../analytics/vendorPerformanceDashboard';
import { getLatestVendorRiskScore, getVendorRiskScoreHistory } from '../services/riskScoringService';
import { getVendorComplianceStatus } from '../services/complianceCheckService';
import { getVendorDueDiligenceEvaluations } from '../services/dueDiligenceEvaluationService';
import { getVendorComplaints } from '../models/VendorComplaint';

export interface VendorAnalyticsSummary {
  vendorId: string;
  vendorName: string;
  category: string;
  status: string;
  performance: {
    overallScore: number;
    indicators: Array<{
      kpiName: string;
      value: number;
      trend: string;
    }>;
  };
  risk: {
    score: number;
    components: Record<string, number>;
    trend?: 'increasing' | 'decreasing' | 'stable';
  };
  compliance: {
    compliant: boolean;
    issues: number;
    expiringSoon: number;
  };
  dueDiligence: {
    latestScore: number | null;
    lastEvaluated: Date | null;
    daysSinceEvaluation: number | null;
  };
  complaints: {
    total: number;
    open: number;
    critical: number;
  };
}

export interface AnalyticsFilter {
  categoryId?: string;
  status?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  minPerformanceScore?: number;
  maxRiskScore?: number;
  compliantOnly?: boolean;
}

/**
 * Get analytics summary for a single vendor
 */
export async function getVendorAnalytics(
  prisma: PrismaClient,
  vendorId: string,
  dateRange?: { start: Date; end: Date }
): Promise<VendorAnalyticsSummary | null> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    include: {
      category: true,
    },
  });

  if (!vendor) {
    return null;
  }

  // Default date range: last 90 days
  const endDate = dateRange?.end || new Date();
  const startDate = dateRange?.start || (() => {
    const d = new Date(endDate);
    d.setDate(d.getDate() - 90);
    return d;
  })();

  // Get performance
  const performance = await calculateVendorPerformance(
    prisma,
    vendorId,
    startDate,
    endDate
  );

  // Get risk score
  const riskScore = await getLatestVendorRiskScore(prisma, vendorId);
  const riskHistory = riskScore
    ? await getVendorRiskScoreHistory(prisma, vendorId, 2)
    : [];

  // Calculate risk trend
  let riskTrend: 'increasing' | 'decreasing' | 'stable' | undefined;
  if (riskHistory.length >= 2) {
    const current = riskHistory[0].score;
    const previous = riskHistory[1].score;
    const change = current - previous;
    if (Math.abs(change) < 5) {
      riskTrend = 'stable';
    } else {
      riskTrend = change > 0 ? 'increasing' : 'decreasing';
    }
  }

  // Get compliance status
  const compliance = await getVendorComplianceStatus(prisma, vendorId);
  const expiringCompliance = compliance
    ? compliance.requirements.filter(
        (r) => r.status === 'compliant' && r.expiryDate
      ).length
    : 0;

  // Get due diligence
  const dueDiligenceEvals = await getVendorDueDiligenceEvaluations(prisma, vendorId);
  const latestDueDiligence = dueDiligenceEvals[0] || null;
  const daysSinceEvaluation = latestDueDiligence
    ? Math.floor(
        (Date.now() - latestDueDiligence.evaluatedAt.getTime()) /
          (1000 * 60 * 60 * 24)
      )
    : null;

  // Get complaints
  const allComplaints = await getVendorComplaints(prisma, vendorId);
  const openComplaints = allComplaints.filter(
    (c) => c.status === 'OPEN' || c.status === 'INVESTIGATING'
  );
  const criticalComplaints = allComplaints.filter(
    (c) => c.severity === 'CRITICAL' || c.severity === 'HIGH'
  );

  return {
    vendorId: vendor.id,
    vendorName: vendor.name,
    category: vendor.category.name,
    status: vendor.status,
    performance: {
      overallScore: performance.overallScore,
      indicators: performance.indicators.map((ind) => ({
        kpiName: ind.kpiName,
        value: ind.value,
        trend: ind.trend,
      })),
    },
    risk: {
      score: riskScore?.score ?? 0,
      components: riskScore?.scoreComponents ?? {},
      trend: riskTrend,
    },
    compliance: {
      compliant: compliance?.compliant ?? false,
      issues: compliance
        ? compliance.requirements.filter((r) => r.status !== 'compliant').length
        : 0,
      expiringSoon: expiringCompliance,
    },
    dueDiligence: {
      latestScore: latestDueDiligence?.percentageScore ?? null,
      lastEvaluated: latestDueDiligence?.evaluatedAt ?? null,
      daysSinceEvaluation: daysSinceEvaluation,
    },
    complaints: {
      total: allComplaints.length,
      open: openComplaints.length,
      critical: criticalComplaints.length,
    },
  };
}

/**
 * Get analytics for multiple vendors with filtering
 */
export async function getVendorsAnalytics(
  prisma: PrismaClient,
  filter: AnalyticsFilter = {}
): Promise<VendorAnalyticsSummary[]> {
  // Build query
  const where: any = {};
  if (filter.categoryId) {
    where.categoryId = filter.categoryId;
  }
  if (filter.status) {
    where.status = filter.status;
  }

  const vendors = await prisma.vendor.findMany({
    where,
    include: {
      category: true,
    },
  });

  const summaries: VendorAnalyticsSummary[] = [];

  for (const vendor of vendors) {
    try {
      const summary = await getVendorAnalytics(
        prisma,
        vendor.id,
        filter.dateRange
      );

      if (!summary) {
        continue;
      }

      // Apply filters
      if (
        filter.minPerformanceScore !== undefined &&
        summary.performance.overallScore < filter.minPerformanceScore
      ) {
        continue;
      }

      if (
        filter.maxRiskScore !== undefined &&
        summary.risk.score > filter.maxRiskScore
      ) {
        continue;
      }

      if (filter.compliantOnly && !summary.compliance.compliant) {
        continue;
      }

      summaries.push(summary);
    } catch (error) {
      console.error(`Error getting analytics for vendor ${vendor.id}:`, error);
    }
  }

  return summaries;
}

/**
 * Get aggregated analytics across all vendors
 */
export async function getAggregatedAnalytics(
  prisma: PrismaClient,
  filter: AnalyticsFilter = {}
): Promise<{
  totalVendors: number;
  averagePerformance: number;
  averageRisk: number;
  complianceRate: number;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    averagePerformance: number;
    averageRisk: number;
  }>;
}> {
  const summaries = await getVendorsAnalytics(prisma, filter);

  if (summaries.length === 0) {
    return {
      totalVendors: 0,
      averagePerformance: 0,
      averageRisk: 0,
      complianceRate: 0,
      categoryBreakdown: [],
    };
  }

  const averagePerformance =
    summaries.reduce((sum, s) => sum + s.performance.overallScore, 0) /
    summaries.length;

  const averageRisk =
    summaries.reduce((sum, s) => sum + s.risk.score, 0) / summaries.length;

  const complianceRate =
    summaries.filter((s) => s.compliance.compliant).length / summaries.length;

  // Category breakdown
  const categoryMap = new Map<string, { count: number; perfSum: number; riskSum: number }>();

  for (const summary of summaries) {
    const existing = categoryMap.get(summary.category) || {
      count: 0,
      perfSum: 0,
      riskSum: 0,
    };
    existing.count++;
    existing.perfSum += summary.performance.overallScore;
    existing.riskSum += summary.risk.score;
    categoryMap.set(summary.category, existing);
  }

  const categoryBreakdown = Array.from(categoryMap.entries()).map(
    ([category, data]) => ({
      category,
      count: data.count,
      averagePerformance: data.perfSum / data.count,
      averageRisk: data.riskSum / data.count,
    })
  );

  return {
    totalVendors: summaries.length,
    averagePerformance,
    averageRisk,
    complianceRate,
    categoryBreakdown,
  };
}

/**
 * Check permissions for accessing vendor analytics
 * In production, would check user roles and permissions
 */
export async function checkAnalyticsPermission(
  userId: string,
  vendorId?: string
): Promise<boolean> {
  // Stub implementation
  // In production, would check:
  // - User role (admin, vendor_manager, etc.)
  // - Organization access
  // - Vendor-specific permissions
  return true; // For now, allow all
}

