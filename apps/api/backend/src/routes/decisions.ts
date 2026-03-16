import type { Express } from 'express';
import { registerDecisionRecommendationRoutes } from './decisionRecommendations';

export function registerDecisionRoutes(app: Express): void {
  registerDecisionRecommendationRoutes(app);
}
