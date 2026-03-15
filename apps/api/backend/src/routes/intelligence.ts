/**
 * intelligence.ts — Intelligence Engine API
 */

import type { Express, Request, Response } from 'express';
import { suggestSearch } from '../services/search/searchIndex';
import { resolveSearchRequestContext } from '../services/search/requestContext';
import {
  getOrchestratorStatus,
  runOrchestrationCycle,
  runIngestionLoop,
  runAnomalyLoop,
  generateInsights,
  getCachedInsights,
  getRecentEvents,
  getDecisionLearningState,
  recordAiDecision,
  calibrateConfidenceThresholds,
} from '../services/intelligence/intelligenceEngine';
import {
  getSourceReliabilityScore,
  listAnomalyHistory,
  listGraphInsights,
  listTrustScoreHistory,
  recordAlertOutcome,
  recordLearningSignal,
  recordSourceIngestionFeedback,
  rebuildGraphInsights,
} from '../services/intelligence/intelligenceEngineService';
import {
  predictSearchSuggestions,
  recordQuerySuggestionFeedback,
} from '../services/intelligence/queryPredictionService';
import type { LearningEventInput } from '../../../../../core/intelligence/learningMemory';
import { log } from '../obs/logger';

const NPI_RE = /^\d{10}$/;

export function registerIntelligenceEngineRoutes(app: Express): void {
  app.get('/api/intelligence/status', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/intelligence/v1',
      ...getOrchestratorStatus(),
    });
  });

  app.post('/api/intelligence/cycle', async (req: Request, res: Response) => {
    const body = req.body as { npis?: string[]; maxIngestions?: number; skipInsights?: boolean } | undefined;
    try {
      const result = await runOrchestrationCycle({
        npis: body?.npis,
        maxIngestions: body?.maxIngestions,
        skipInsights: body?.skipInsights,
      });
      res.json({ schema: 'https://vitalcv.com/intelligence-cycle/v1', ...result });
    } catch (err) {
      log('error', `[Intelligence] Cycle failed: ${(err as Error)?.message}`);
      res.status(500).json({ error: 'Orchestration cycle failed' });
    }
  });

  app.post('/api/intelligence/ingest/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI' });
      return;
    }

    try {
      res.json(await runIngestionLoop(npi));
    } catch {
      res.status(500).json({ error: 'Ingestion loop failed', npi });
    }
  });

  app.post('/api/intelligence/anomaly/:npi', async (req: Request, res: Response) => {
    const { npi } = req.params;
    if (!NPI_RE.test(npi)) {
      res.status(400).json({ error: 'Invalid NPI' });
      return;
    }

    try {
      const result = await runAnomalyLoop(npi);
      res.status(result.divergenceCount > 0 ? 207 : 200).json(result);
    } catch {
      res.status(500).json({ error: 'Anomaly detection failed', npi });
    }
  });

  app.get('/api/intelligence/insights', async (req: Request, res: Response) => {
    const fresh = req.query.fresh === 'true';
    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
    try {
      const insights = fresh
        ? await generateInsights({ limit: limitParam })
        : getCachedInsights();
      res.json({
        count: insights.length,
        insights,
        cached: !fresh,
        generatedAt: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({ error: 'Insight generation failed' });
    }
  });

  app.get('/api/intelligence/insights/graph', async (_req: Request, res: Response) => {
    try {
      const insights = await rebuildGraphInsights({ graphMode: 'blended' });
      res.json({ count: insights.length, insights, generatedAt: new Date().toISOString() });
    } catch {
      res.status(500).json({ error: 'Graph insight generation failed' });
    }
  });

  app.get('/api/intelligence/events', (req: Request, res: Response) => {
    const limitParam = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
    const events = getRecentEvents(Math.min(limitParam, 500));
    res.json({ count: events.length, events });
  });

  app.get('/api/intelligence/learning', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/decision-learning/v1',
      ...getDecisionLearningState(),
    });
  });

  app.post('/api/intelligence/learning/record', (req: Request, res: Response) => {
    const { suggestionId, action, strategy } = req.body as {
      suggestionId?: string;
      action?: string;
      strategy?: string;
    };
    if (!suggestionId || (action !== 'accept' && action !== 'reject')) {
      res.status(400).json({ error: 'Body must include suggestionId and action (accept|reject)' });
      return;
    }

    recordAiDecision(suggestionId, action, strategy);
    res.json({ recorded: true, state: getDecisionLearningState() });
  });

  app.get('/api/intelligence/confidence', (_req: Request, res: Response) => {
    res.json({
      schema: 'https://vitalcv.com/confidence-calibration/v1',
      thresholds: calibrateConfidenceThresholds(),
      decisionState: getDecisionLearningState(),
      computedAt: new Date().toISOString(),
    });
  });

  app.post('/api/intelligence/events', async (req: Request, res: Response) => {
    try {
      const {
        eventType,
        loopType,
        subjectType,
        subjectId,
        sourceId,
        relatedId,
        status,
        confidence,
        scoreDelta,
        signalStrength,
        metadata,
        occurredAt,
        dedupeKey,
      } = req.body ?? {};

      if (
        typeof eventType !== 'string'
        || typeof loopType !== 'string'
        || typeof subjectType !== 'string'
        || typeof subjectId !== 'string'
      ) {
        res.status(400).json({ error: 'eventType, loopType, subjectType, and subjectId are required' });
        return;
      }

      const event = await recordLearningSignal({
        eventType: eventType as LearningEventInput['eventType'],
        loopType: loopType as LearningEventInput['loopType'],
        subjectType,
        subjectId,
        sourceId: typeof sourceId === 'string' ? sourceId : null,
        relatedId: typeof relatedId === 'string' ? relatedId : null,
        status: typeof status === 'string' ? status : null,
        confidence: typeof confidence === 'number' ? confidence : null,
        scoreDelta: typeof scoreDelta === 'number' ? scoreDelta : null,
        signalStrength: typeof signalStrength === 'number' ? signalStrength : null,
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
        occurredAt: typeof occurredAt === 'string' ? occurredAt : undefined,
        dedupeKey: typeof dedupeKey === 'string' ? dedupeKey : null,
      });

      res.status(201).json({ event });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] event record failed: ${message}`);
      res.status(500).json({ error: 'Failed to record learning event' });
    }
  });

  app.post('/api/intelligence/feedback/source', async (req: Request, res: Response) => {
    try {
      const { sourceId, subjectType, subjectId, status, confidence, metadata } = req.body ?? {};
      if (
        typeof sourceId !== 'string'
        || typeof subjectType !== 'string'
        || typeof subjectId !== 'string'
        || (status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'PARTIAL')
      ) {
        res.status(400).json({ error: 'sourceId, subjectType, subjectId, and status are required' });
        return;
      }

      res.status(201).json(await recordSourceIngestionFeedback({
        sourceId,
        subjectType,
        subjectId,
        status,
        confidence: typeof confidence === 'number' ? confidence : null,
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] source feedback failed: ${message}`);
      res.status(500).json({ error: 'Failed to record source feedback' });
    }
  });

  app.post('/api/intelligence/feedback/alert', async (req: Request, res: Response) => {
    try {
      const { sourceId, subjectType, subjectId, outcome, confidence, metadata } = req.body ?? {};
      if (
        typeof subjectType !== 'string'
        || typeof subjectId !== 'string'
        || !['TRUE_POSITIVE', 'FALSE_POSITIVE', 'ESCALATED', 'DISMISSED'].includes(outcome)
      ) {
        res.status(400).json({ error: 'subjectType, subjectId, and outcome are required' });
        return;
      }

      res.status(201).json(await recordAlertOutcome({
        sourceId: typeof sourceId === 'string' ? sourceId : null,
        subjectType,
        subjectId,
        outcome,
        confidence: typeof confidence === 'number' ? confidence : null,
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] alert feedback failed: ${message}`);
      res.status(500).json({ error: 'Failed to record alert outcome' });
    }
  });

  app.get('/api/intelligence/sources/:sourceId/reliability', async (req: Request, res: Response) => {
    try {
      res.json(await getSourceReliabilityScore(req.params.sourceId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] source reliability failed: ${message}`);
      res.status(500).json({ error: 'Failed to load source reliability score' });
    }
  });

  app.get('/api/intelligence/anomalies/:subjectType/:subjectId', async (req: Request, res: Response) => {
    try {
      const anomalies = await listAnomalyHistory(req.params.subjectType, req.params.subjectId);
      res.json({ count: anomalies.length, anomalies });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] anomaly history failed: ${message}`);
      res.status(500).json({ error: 'Failed to load anomaly history' });
    }
  });

  app.get('/api/intelligence/trust/:subjectType/:subjectId/history', async (req: Request, res: Response) => {
    try {
      const history = await listTrustScoreHistory(req.params.subjectType, req.params.subjectId);
      res.json({ count: history.length, history });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] trust history failed: ${message}`);
      res.status(500).json({ error: 'Failed to load trust score history' });
    }
  });

  app.post('/api/intelligence/graph/insights/rebuild', async (req: Request, res: Response) => {
    try {
      const nodeId = typeof req.body?.nodeId === 'string' ? req.body.nodeId : null;
      const graphMode = typeof req.body?.graphMode === 'string' ? req.body.graphMode : 'blended';
      const insights = await rebuildGraphInsights({ nodeId, graphMode });
      res.status(201).json({
        count: insights.length,
        insights,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] graph insight rebuild failed: ${message}`);
      res.status(500).json({ error: 'Failed to rebuild graph insights' });
    }
  });

  app.get('/api/intelligence/graph/insights/:nodeId', async (req: Request, res: Response) => {
    try {
      const insights = await listGraphInsights(req.params.nodeId);
      res.json({ count: insights.length, insights });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] graph insight list failed: ${message}`);
      res.status(500).json({ error: 'Failed to load graph insights' });
    }
  });

  app.post('/api/intelligence/query/suggest', async (req: Request, res: Response) => {
    try {
      const body = req.body as { q?: string; query?: string; limit?: number };
      const q = body.q?.trim() || body.query?.trim();
      if (!q) {
        res.status(400).json({ error: 'q is required.' });
        return;
      }

      const requestContext = await resolveSearchRequestContext(req, q);
      const baseSuggestions = await suggestSearch(q, body.limit ?? 5, {
        aclLevel: requestContext.aclLevel,
        orgId: requestContext.organizationId,
        roles: requestContext.membershipRoles,
      });
      res.json(await predictSearchSuggestions({
        query: q,
        limit: body.limit ?? 5,
        baseSuggestions: baseSuggestions.suggestions,
        context: {
          aclLevel: requestContext.aclLevel,
          organizationId: requestContext.organizationId,
          clerkUserId: requestContext.clerkUserId,
          clerkUserEmail: requestContext.clerkUserEmail,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] query suggest failed: ${message}`);
      res.status(500).json({ error: 'Failed to generate predictive query suggestions' });
    }
  });

  app.post('/api/intelligence/query/feedback', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        query?: string;
        suggestion?: string;
        accepted?: boolean;
        metadata?: Record<string, unknown>;
      };

      if (typeof body.query !== 'string' || typeof body.suggestion !== 'string' || typeof body.accepted !== 'boolean') {
        res.status(400).json({ error: 'query, suggestion, and accepted are required.' });
        return;
      }

      const requestContext = await resolveSearchRequestContext(req, body.query);
      await recordQuerySuggestionFeedback({
        query: body.query,
        suggestion: body.suggestion,
        accepted: body.accepted,
        context: {
          aclLevel: requestContext.aclLevel,
          organizationId: requestContext.organizationId,
          clerkUserId: requestContext.clerkUserId,
          clerkUserEmail: requestContext.clerkUserEmail,
        },
        metadata: body.metadata,
      });

      res.status(201).json({ recorded: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      log('error', `[Intelligence] query feedback failed: ${message}`);
      res.status(500).json({ error: 'Failed to record query feedback' });
    }
  });
}
