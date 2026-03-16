import { z } from 'zod';

export const strategyInsightTypeSchema = z.enum([
  'PROVIDER_OPPORTUNITY',
  'SPECIALTY_SHIFT',
  'INSTITUTION_GROWTH',
  'NETWORK_CLUSTER_FORMING',
  'TALENT_MIGRATION',
  'RESEARCH_ACCELERATION',
]);

export const strategyInsightCategorySchema = z.enum([
  'trend_insight',
  'strategic_opportunity',
  'strategic_risk',
]);

export const strategyImpactLevelSchema = z.enum([
  'strategic',
  'major',
  'moderate',
  'minor',
]);

export const strategyScopeSchema = z.object({
  entityType: z.enum(['provider', 'institution', 'specialty', 'network', 'market']),
  entityId: z.string(),
  entityLabel: z.string().nullable().optional(),
  geography: z.string().nullable().optional(),
  specialty: z.string().nullable().optional(),
});

export const strategyEntityRefSchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  entityLabel: z.string().nullable().optional(),
  relationship: z.string().nullable().optional(),
});

export const strategyDriverSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  direction: z.enum(['UP', 'DOWN', 'FLAT']),
  source: z.string(),
  explanation: z.string(),
});

export const strategySupportingPredictionSchema = z.object({
  predictionId: z.string(),
  predictionType: z.string(),
  probability: z.number(),
  confidence: z.number(),
  explanation: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  metadata: z.record(z.string(), z.unknown()),
});

export const strategyInsightSchema = z.object({
  id: z.string(),
  type: strategyInsightTypeSchema,
  category: strategyInsightCategorySchema,
  scope: strategyScopeSchema,
  title: z.string(),
  summary: z.string(),
  impactLevel: strategyImpactLevelSchema,
  confidence: z.number(),
  explanation: z.string(),
  drivers: z.array(strategyDriverSchema),
  affectedEntities: z.array(strategyEntityRefSchema),
  recommendedActions: z.array(z.string()),
  supportingPredictions: z.array(strategySupportingPredictionSchema),
  supportingStorylineIds: z.array(z.string()),
  supportingActionIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const strategyListResponseSchema = z.object({
  insights: z.array(strategyInsightSchema),
  total: z.number().int().nonnegative(),
  generatedAt: z.string(),
  filters: z.object({
    type: strategyInsightTypeSchema.optional(),
    impactLevel: strategyImpactLevelSchema.optional(),
    confidence: z.number().optional(),
    entityType: z.string().optional(),
    limit: z.number().int().positive().optional(),
  }),
  summary: z.object({
    byType: z.record(z.string(), z.number().int().nonnegative()),
    byImpactLevel: z.record(z.string(), z.number().int().nonnegative()),
    byCategory: z.record(z.string(), z.number().int().nonnegative()),
  }),
});

export type StrategyInsightContract = z.infer<typeof strategyInsightSchema>;
export type StrategyListResponseContract = z.infer<typeof strategyListResponseSchema>;
