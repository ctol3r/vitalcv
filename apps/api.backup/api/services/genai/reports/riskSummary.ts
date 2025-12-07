const log = getServiceLogger('genai/reports/riskSummary');
/**
 * B131F-GENAI-006: GenAI risk report service
 *
 * Aggregates DecisionLog to show top risk categories per model.
 * Outputs JSON report with weekly snapshots stored in GenAiRiskReport table.
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { getServiceLogger } from '../../logging/serviceLogger';

// Use singleton pattern for Prisma client
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

export interface RiskSummary {
  modelId: string;
  modelName?: string;
  provider?: string;
  decisionCount: number;
  overrideCount: number;
  overrideRate: number;
  topRisks: Array<{
    riskId: string;
    category: string;
    count: number;
    percentage: number;
  }>;
  riskBreakdown: Array<{
    riskId: string;
    category: string;
    severity?: string;
    count: number;
    percentage: number;
  }>;
  periodStart: Date;
  periodEnd: Date;
}

export interface AggregateRiskSummary {
  totalDecisions: number;
  totalOverrides: number;
  overallOverrideRate: number;
  models: RiskSummary[];
  topRisksAcrossModels: Array<{
    riskId: string;
    category: string;
    totalCount: number;
    percentage: number;
  }>;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Generate risk summary for a specific model
 */
export async function generateModelRiskSummary(
  modelId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<RiskSummary | null> {
  // Get model card
  const modelCard = await prisma.modelCard.findUnique({
    where: { modelId },
  });

  if (!modelCard) {
    return null;
  }

  // Get decision logs for this model in the period
  const decisionLogs = await prisma.decisionLog.findMany({
    where: {
      modelId,
      timestamp: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
  });

  const decisionCount = decisionLogs.length;
  const overrideCount = decisionLogs.filter((log) => log.humanOverride).length;
  const overrideRate = decisionCount > 0 ? overrideCount / decisionCount : 0;

  // Count risk tags
  const riskCounts: Map<string, number> = new Map();
  for (const log of decisionLogs) {
    for (const riskTag of log.riskTags) {
      riskCounts.set(riskTag, (riskCounts.get(riskTag) || 0) + 1);
    }
  }

  // Get risk category details
  const riskIds = Array.from(riskCounts.keys());
  const riskCategories = await prisma.riskCategory.findMany({
    where: {
      riskId: {
        in: riskIds,
      },
    },
  });

  // Build top risks
  const topRisks = Array.from(riskCounts.entries())
    .map(([riskId, count]) => {
      const category = riskCategories.find((rc) => rc.riskId === riskId);
      return {
        riskId,
        category: category?.category || riskId,
        count,
        percentage: decisionCount > 0 ? (count / decisionCount) * 100 : 0,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 risks

  // Build risk breakdown (includes model-specific risks from ModelRisk)
  const modelRisks = await prisma.modelRisk.findMany({
    where: {
      modelCardId: modelCard.id,
    },
    include: {
      riskCategory: true,
    },
  });

  const riskBreakdown = modelRisks.map((mr) => {
    const count = riskCounts.get(mr.riskCategory.riskId) || 0;
    return {
      riskId: mr.riskCategory.riskId,
      category: mr.riskCategory.category,
      severity: mr.severity,
      count,
      percentage: decisionCount > 0 ? (count / decisionCount) * 100 : 0,
    };
  });

  return {
    modelId,
    modelName: modelCard.modelId,
    provider: modelCard.provider,
    decisionCount,
    overrideCount,
    overrideRate,
    topRisks,
    riskBreakdown,
    periodStart,
    periodEnd,
  };
}

/**
 * Generate aggregate risk summary for all models
 */
export async function generateAggregateRiskSummary(
  periodStart: Date,
  periodEnd: Date
): Promise<AggregateRiskSummary> {
  // Get all model cards
  const modelCards = await prisma.modelCard.findMany({
    where: { isActive: true },
  });

  // Generate risk summaries for each model
  const modelSummaries = await Promise.all(
    modelCards.map((card) => generateModelRiskSummary(card.modelId, periodStart, periodEnd))
  );

  const models = modelSummaries.filter((s): s is RiskSummary => s !== null);

  // Calculate aggregate statistics
  const totalDecisions = models.reduce((sum, m) => sum + m.decisionCount, 0);
  const totalOverrides = models.reduce((sum, m) => sum + m.overrideCount, 0);
  const overallOverrideRate = totalDecisions > 0 ? totalOverrides / totalDecisions : 0;

  // Aggregate top risks across all models
  const riskCountsAcrossModels: Map<string, number> = new Map();
  for (const model of models) {
    for (const risk of model.topRisks) {
      riskCountsAcrossModels.set(risk.riskId, (riskCountsAcrossModels.get(risk.riskId) || 0) + risk.count);
    }
  }

  // Get risk category details
  const riskIds = Array.from(riskCountsAcrossModels.keys());
  const riskCategories = await prisma.riskCategory.findMany({
    where: {
      riskId: {
        in: riskIds,
      },
    },
  });

  const topRisksAcrossModels = Array.from(riskCountsAcrossModels.entries())
    .map(([riskId, totalCount]) => {
      const category = riskCategories.find((rc) => rc.riskId === riskId);
      return {
        riskId,
        category: category?.category || riskId,
        totalCount,
        percentage: totalDecisions > 0 ? (totalCount / totalDecisions) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10); // Top 10 risks

  return {
    totalDecisions,
    totalOverrides,
    overallOverrideRate,
    models,
    topRisksAcrossModels,
    periodStart,
    periodEnd,
  };
}

/**
 * Store risk summary snapshot in database
 */
export async function storeRiskSummarySnapshot(
  summary: RiskSummary | AggregateRiskSummary,
  modelId?: string
): Promise<string> {
  // Compute hash of summary data
  const summaryData = JSON.stringify(summary);
  const snapshotHash = crypto.createHash('sha256').update(summaryData).digest('hex');

  // Store snapshot
  const report = await prisma.genAiRiskReport.create({
    data: {
      reportDate: new Date(),
      periodStart: summary.periodStart,
      periodEnd: summary.periodEnd,
      modelId: modelId || null,
      riskCategoryId: null, // Aggregate report
      decisionCount: 'decisionCount' in summary ? summary.decisionCount : summary.totalDecisions,
      overrideCount: 'overrideCount' in summary ? summary.overrideCount : summary.totalOverrides,
      overrideRate:
        'overrideRate' in summary ? summary.overrideRate : summary.overallOverrideRate,
      topRisks: 'topRisks' in summary ? summary.topRisks : summary.topRisksAcrossModels,
      summary: summary,
      snapshotHash,
    },
  });

  return report.id;
}

/**
 * Generate weekly risk report and store snapshot
 */
export async function generateWeeklyRiskReport(): Promise<{
  reportId: string;
  summary: AggregateRiskSummary;
}> {
  const now = new Date();
  const periodEnd = new Date(now);
  const periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  // Generate aggregate summary
  const summary = await generateAggregateRiskSummary(periodStart, periodEnd);

  // Store snapshot
  const reportId = await storeRiskSummarySnapshot(summary);

  log.info(`[GenAI Risk Report] Generated weekly report: ${reportId}`);
  log.info(`[GenAI Risk Report] Total decisions: ${summary.totalDecisions}`);
  log.info(`[GenAI Risk Report] Overall override rate: ${(summary.overallOverrideRate * 100).toFixed(2)}%`);

  return {
    reportId,
    summary,
  };
}

/**
 * Generate model-specific risk report and store snapshot
 */
export async function generateModelRiskReport(
  modelId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<{
  reportId: string;
  summary: RiskSummary | null;
}> {
  const summary = await generateModelRiskSummary(modelId, periodStart, periodEnd);

  if (!summary) {
    return {
      reportId: '',
      summary: null,
    };
  }

  // Store snapshot
  const reportId = await storeRiskSummarySnapshot(summary, modelId);

  log.info(`[GenAI Risk Report] Generated model report for ${modelId}: ${reportId}`);
  log.info(`[GenAI Risk Report] Decision count: ${summary.decisionCount}`);
  log.info(`[GenAI Risk Report] Override rate: ${(summary.overrideRate * 100).toFixed(2)}%`);

  return {
    reportId,
    summary,
  };
}

/**
 * Get latest risk report snapshot
 */
export async function getLatestRiskReport(modelId?: string): Promise<any> {
  const where: any = {};
  if (modelId) {
    where.modelId = modelId;
  }

  const report = await prisma.genAiRiskReport.findFirst({
    where,
    orderBy: {
      reportDate: 'desc',
    },
  });

  return report;
}

/**
 * Get risk reports for a date range
 */
export async function getRiskReports(
  periodStart: Date,
  periodEnd: Date,
  modelId?: string
): Promise<any[]> {
  const where: any = {
    periodStart: {
      gte: periodStart,
    },
    periodEnd: {
      lte: periodEnd,
    },
  };

  if (modelId) {
    where.modelId = modelId;
  }

  const reports = await prisma.genAiRiskReport.findMany({
    where,
    orderBy: {
      reportDate: 'desc',
    },
  });

  return reports;
}

