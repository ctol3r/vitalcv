import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import {
  strategyAgentInsightListResponseSchema,
  strategyAgentListResponseSchema,
  strategyAgentReportListResponseSchema,
  strategyAgentRunResponseSchema,
  strategyAgentTypeSchema,
  strategyImpactLevelSchema,
  type StrategyAgentType,
  type StrategyImpactLevel,
} from '../services/strategyAgents/contracts';
import {
  listStrategyAgentStatuses,
  listStrategyInsights,
  listStrategyReports,
  runStrategyAgents,
} from '../services/strategyAgents/strategyAgentService';
import {
  getStrategyAgentSchedulerState,
  getStrategyAgentSchedulerSummary,
} from '../services/strategyAgents/strategyAgentScheduler';

function readQueryValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (Array.isArray(value)) {
    const first = value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
    return first?.trim();
  }

  return undefined;
}

function readAgentType(value: unknown): StrategyAgentType | undefined {
  const raw = readQueryValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = strategyAgentTypeSchema.safeParse(raw.toUpperCase());
  return parsed.success ? parsed.data : undefined;
}

function readImpactLevel(value: unknown): StrategyImpactLevel | undefined {
  const raw = readQueryValue(value);
  if (!raw) {
    return undefined;
  }

  const parsed = strategyImpactLevelSchema.safeParse(raw.toUpperCase());
  return parsed.success ? parsed.data : undefined;
}

function readLimit(value: unknown, fallback = 20): number {
  const raw = readQueryValue(value);
  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

export function registerAgentRoutes(app: Express): void {
  app.get('/api/agents', async (_req: Request, res: Response) => {
    try {
      const scheduler = getStrategyAgentSchedulerSummary();
      const agents = await listStrategyAgentStatuses(getStrategyAgentSchedulerState());

      res.json(strategyAgentListResponseSchema.parse({
        schema: 'https://vitalcv.com/strategy-agents/v1',
        scheduler,
        agents,
        generatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_agents_status_failed', { error: message });
      res.status(500).json({ error: 'Failed to load strategy agents', detail: message });
    }
  });

  app.get('/api/agents/reports', async (req: Request, res: Response) => {
    try {
      const agentType = readAgentType(req.query.agentType);
      const impactLevel = readImpactLevel(req.query.impactLevel);
      const timeRange = readQueryValue(req.query.timeRange);
      const limit = readLimit(req.query.limit, 20);
      const result = await listStrategyReports({
        agentType,
        impactLevel,
        timeRange,
        limit,
      });

      res.json(strategyAgentReportListResponseSchema.parse({
        schema: 'https://vitalcv.com/strategy-agents/reports/v1',
        total: result.total,
        reports: result.reports,
        filters: {
          agentType,
          timeRange,
          impactLevel,
        },
        generatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_agents_reports_failed', { error: message });
      res.status(500).json({ error: 'Failed to load strategy agent reports', detail: message });
    }
  });

  app.get('/api/agents/insights', async (req: Request, res: Response) => {
    try {
      const agentType = readAgentType(req.query.agentType);
      const impactLevel = readImpactLevel(req.query.impactLevel);
      const timeRange = readQueryValue(req.query.timeRange);
      const limit = readLimit(req.query.limit, 20);
      const result = await listStrategyInsights({
        agentType,
        impactLevel,
        timeRange,
        limit,
      });

      res.json(strategyAgentInsightListResponseSchema.parse({
        schema: 'https://vitalcv.com/strategy-agents/insights/v1',
        total: result.total,
        insights: result.insights,
        filters: {
          agentType,
          timeRange,
          impactLevel,
        },
        generatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_agents_insights_failed', { error: message });
      res.status(500).json({ error: 'Failed to load strategy agent insights', detail: message });
    }
  });

  app.post('/api/agents/run', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        agentType?: string | string[];
        timeRange?: string;
        refreshPredictions?: boolean;
      } | undefined;

      const agentTypes = Array.isArray(body?.agentType)
        ? body.agentType
          .map((value) => strategyAgentTypeSchema.safeParse(value.toUpperCase()))
          .filter((result): result is { success: true; data: StrategyAgentType } => result.success)
          .map((result) => result.data)
        : typeof body?.agentType === 'string'
          ? (() => {
            const parsed = strategyAgentTypeSchema.safeParse(body.agentType.toUpperCase());
            return parsed.success ? [parsed.data] : [];
          })()
          : undefined;

      const runs = await runStrategyAgents({
        agentTypes,
        timeRange: typeof body?.timeRange === 'string' ? body.timeRange : undefined,
        trigger: 'manual',
        refreshPredictions: body?.refreshPredictions !== false,
      });

      res.json(strategyAgentRunResponseSchema.parse({
        schema: 'https://vitalcv.com/strategy-agents/run/v1',
        runs,
        generatedAt: new Date().toISOString(),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      log('error', 'strategy_agents_run_failed', { error: message });
      res.status(500).json({ error: 'Failed to run strategy agents', detail: message });
    }
  });
}
