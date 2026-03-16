import { z } from 'zod';

export const predictionTypeSchema = z.enum([
  'PROVIDER_TRAJECTORY',
  'SPECIALTY_PRESSURE',
  'INSTITUTION_MOMENTUM',
  'NETWORK_SHIFT',
  'TRUST_RISK_ACCELERATION',
]);

export const predictionStateSchema = z.enum([
  'rising',
  'stable',
  'declining',
  'volatile',
  'low',
  'moderate',
  'high',
  'severe',
  'expanding',
  'contracting',
  'mixed',
  'emerging cluster',
  'emerging_cluster',
  'expanding collaboration',
  'collaboration_expansion',
  'network fragmentation',
  'network_fragmentation',
  'bridge provider shift',
  'bridge_provider_shift',
  'accelerating',
  'watch',
  'stabilizing',
  'insufficient_signal',
]);

export const predictionSignalSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  direction: z.enum(['UP', 'DOWN', 'FLAT']),
  source: z.string().nullable().optional(),
  observedAt: z.string().optional(),
});

export const predictionDriverSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  direction: z.enum(['UP', 'DOWN', 'FLAT']),
  source: z.string(),
  explanation: z.string(),
  observedAt: z.string().optional(),
});

export const predictionTargetEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  entityLabel: z.string().nullable().optional(),
});

export const predictionSchema = z.object({
  id: z.string(),
  type: predictionTypeSchema,
  entityType: z.string(),
  entityId: z.string(),
  entityLabel: z.string().nullable().optional(),
  entity: predictionTargetEntitySchema.optional(),
  state: predictionStateSchema,
  score: z.number(),
  scoreLabel: z.string().optional(),
  confidence: z.number(),
  explanation: z.string(),
  signals: z.array(predictionSignalSchema),
  drivers: z.array(predictionDriverSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastUpdated: z.string().optional(),
  last_updated: z.string().optional(),
  forecast: z.boolean(),
  insufficientSignal: z.boolean(),
  summary: z.string(),
  predictionId: z.string(),
  predictionType: predictionTypeSchema,
  probability: z.number(),
  targetEntity: predictionTargetEntitySchema,
  timeHorizon: z.string(),
  evidenceSignals: z.array(predictionSignalSchema),
  metadata: z.record(z.string(), z.unknown()),
});

export const predictionSummaryBucketSchema = z.object({
  key: z.string(),
  count: z.number().int().nonnegative(),
});

export const predictionSummarySchema = z.object({
  available: z.boolean(),
  total: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
  topPrediction: predictionSchema.nullable(),
  predictions: z.array(predictionSchema),
  byType: z.array(predictionSummaryBucketSchema),
  byState: z.array(predictionSummaryBucketSchema),
});

export const predictionListResponseSchema = z.object({
  schema: z.string(),
  predictions: z.array(predictionSchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  syncedAt: z.string().nullable(),
});

export type PredictionContract = z.infer<typeof predictionSchema>;
export type PredictionSummaryContract = z.infer<typeof predictionSummarySchema>;
