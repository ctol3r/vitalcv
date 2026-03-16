import type { Express, Request, Response } from 'express';
import { log } from '../obs/logger';
import type { StoredDecisionRecommendation } from '../services/decisions/decisionRecommendationService';
import {
  getDecisionRecommendation,
  isDecisionRecommendationState,
  listDecisionRecommendations,
  listDecisionRecommendationsForTarget,
  setDecisionRecommendationState,
} from '../services/decisions/decisionRecommendationService';

function readList(value: unknown): string[] {
  if (typeof value !== 'string') {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function readNumber(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readInt(value: unknown, fallback: number): number {
  const parsed = readNumber(value);
  if (parsed === null) {
    return fallback;
  }

  return Math.trunc(parsed);
}

function readDateRange(value: unknown): { from: string | null; to: string | null } {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { from: null, to: null };
  }

  const [from, to] = value.split(',').map((entry) => entry.trim());
  return {
    from: from || null,
    to: to || null,
  };
}

function baseQuery(req: Request) {
  const updatedAt = readDateRange(req.query.updatedAt);
  return {
    actionType: readList(req.query.actionType),
    priority: readList(req.query.priority),
    entityType: readList(req.query.entityType),
    status: readList(req.query.status),
    minConfidence: readNumber(req.query.confidence),
    updatedAtFrom: updatedAt.from,
    updatedAtTo: updatedAt.to,
    limit: readInt(req.query.limit, 50),
    offset: readInt(req.query.offset, 0),
  };
}

function noSignalMessage(total: number): string | undefined {
  return total === 0 ? 'Insufficient signal for recommendation' : undefined;
}

function serializeRecommendation(recommendation: StoredDecisionRecommendation) {
  return recommendation;
}

export function registerDecisionRecommendationRoutes(app: Express): void {
  app.get('/api/decisions', async (req: Request, res: Response) => {
    try {
      const query = baseQuery(req);
      const result = await listDecisionRecommendations(query);

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/v1',
        total: result.total,
        recommendations: result.recommendations.map(serializeRecommendation),
        generatedAt: result.generatedAt,
        filters: {
          actionType: query.actionType,
          priority: query.priority,
          entityType: query.entityType,
          confidence: query.minConfidence,
          status: query.status,
          updatedAt: typeof req.query.updatedAt === 'string' ? req.query.updatedAt : null,
        },
        message: noSignalMessage(result.total),
      });
    } catch (error) {
      log('error', 'decision_recommendations.list_failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to list decision recommendations' });
    }
  });

  app.get('/api/decisions/providers/:id', async (req: Request, res: Response) => {
    try {
      const query = baseQuery(req);
      const result = await listDecisionRecommendationsForTarget('provider', req.params.id, query);

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/provider/v1',
        providerId: req.params.id,
        total: result.total,
        recommendations: result.recommendations.map(serializeRecommendation),
        generatedAt: result.generatedAt,
        message: noSignalMessage(result.total),
      });
    } catch (error) {
      log('error', 'decision_recommendations.provider_failed', {
        providerId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load provider decision recommendations' });
    }
  });

  app.get('/api/decisions/storylines/:id', async (req: Request, res: Response) => {
    try {
      const query = baseQuery(req);
      const result = await listDecisionRecommendationsForTarget('storyline', req.params.id, query);

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/storyline/v1',
        storylineId: req.params.id,
        total: result.total,
        recommendations: result.recommendations.map(serializeRecommendation),
        generatedAt: result.generatedAt,
        message: noSignalMessage(result.total),
      });
    } catch (error) {
      log('error', 'decision_recommendations.storyline_failed', {
        storylineId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load storyline decision recommendations' });
    }
  });

  app.get('/api/decisions/institutions/:id', async (req: Request, res: Response) => {
    try {
      const query = baseQuery(req);
      const result = await listDecisionRecommendationsForTarget('institution', req.params.id, query);

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/institution/v1',
        institutionId: req.params.id,
        total: result.total,
        recommendations: result.recommendations.map(serializeRecommendation),
        generatedAt: result.generatedAt,
        message: noSignalMessage(result.total),
      });
    } catch (error) {
      log('error', 'decision_recommendations.institution_failed', {
        institutionId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load institution decision recommendations' });
    }
  });

  app.get('/api/decisions/specialties/:slug', async (req: Request, res: Response) => {
    try {
      const query = baseQuery(req);
      const result = await listDecisionRecommendationsForTarget('specialty', req.params.slug, query);

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/specialty/v1',
        specialtySlug: req.params.slug,
        total: result.total,
        recommendations: result.recommendations.map(serializeRecommendation),
        generatedAt: result.generatedAt,
        message: noSignalMessage(result.total),
      });
    } catch (error) {
      log('error', 'decision_recommendations.specialty_failed', {
        specialtySlug: req.params.slug,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load specialty decision recommendations' });
    }
  });

  app.get('/api/decisions/recommendations/:id', async (req: Request, res: Response) => {
    try {
      const recommendation = await getDecisionRecommendation(req.params.id);
      if (!recommendation) {
        res.status(404).json({ error: 'Decision recommendation not found' });
        return;
      }

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/detail/v1',
        recommendation: serializeRecommendation(recommendation),
      });
    } catch (error) {
      log('error', 'decision_recommendations.detail_failed', {
        decisionId: req.params.id,
        error: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({ error: 'Failed to load decision recommendation' });
    }
  });

  app.patch('/api/decisions/recommendations/:id/state', async (req: Request, res: Response) => {
    const nextState = typeof req.body?.state === 'string' ? req.body.state : null;
    if (!isDecisionRecommendationState(nextState)) {
      res.status(400).json({
        error: 'state must be one of: new, accepted, dismissed, deferred, completed',
      });
      return;
    }

    try {
      const recommendation = await setDecisionRecommendationState(
        req.params.id,
        nextState,
        {
          actorId: typeof req.body?.actorId === 'string' ? req.body.actorId : null,
          note: typeof req.body?.note === 'string' ? req.body.note : null,
        },
      );

      res.json({
        schema: 'https://vitalcv.com/decision-recommendations/state/v1',
        recommendation: serializeRecommendation(recommendation),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update decision recommendation state';
      if (message.includes('not found')) {
        res.status(404).json({ error: 'Decision recommendation not found' });
        return;
      }
      if (message.includes('Invalid decision state transition')) {
        res.status(409).json({ error: message });
        return;
      }
      log('error', 'decision_recommendations.state_failed', {
        decisionId: req.params.id,
        error: message,
      });
      res.status(500).json({ error: 'Failed to update decision recommendation state' });
    }
  });
}
