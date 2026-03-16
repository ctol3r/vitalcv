import { z } from 'zod';

export const strategyAgentTypeSchema = z.enum([
  'PROVIDER_TRAJECTORY',
  'SPECIALTY_PRESSURE',
  'INSTITUTION_MOMENTUM',
  'NETWORK_EVOLUTION',
]);

export const strategyAgentCadenceSchema = z.enum(['daily', 'weekly', 'monthly']);
export const strategyImpactLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
export const strategySignalDirectionSchema = z.enum(['UP', 'DOWN', 'FLAT']);

export const strategyEntitySchema = z.object({
  entityType: z.string(),
  entityId: z.string(),
  entityLabel: z.string().nullable().optional(),
});

export const strategySignalSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  direction: strategySignalDirectionSchema,
  source: z.string(),
  weight: z.number().min(0).max(1),
  observedAt: z.string().optional(),
});

export const strategyReasoningEntrySchema = z.object({
  step: z.string(),
  detail: z.string(),
});

export const strategyPredictionReferenceSchema = z.object({
  predictionId: z.string(),
  predictionType: z.string(),
  probability: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  timeHorizon: z.string(),
});

export const strategyFindingReferenceSchema = z.object({
  findingId: z.string(),
  severity: z.string(),
  title: z.string(),
});

export const strategyDecisionSchema = z.object({
  decisionId: z.string(),
  agentType: strategyAgentTypeSchema,
  recommendation: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  impactLevel: strategyImpactLevelSchema,
  entities: z.array(strategyEntitySchema),
  reportId: z.string(),
  insightId: z.string().optional(),
  createdAt: z.string(),
});

export const strategyInsightSchema = z.object({
  insightId: z.string(),
  reportId: z.string(),
  agentType: strategyAgentTypeSchema,
  headline: z.string(),
  summary: z.string(),
  drivers: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  impactLevel: strategyImpactLevelSchema,
  entities: z.array(strategyEntitySchema),
  signals: z.array(strategySignalSchema),
  predictions: z.array(strategyPredictionReferenceSchema),
  reasoningLog: z.array(strategyReasoningEntrySchema),
  decisions: z.array(strategyDecisionSchema),
  insufficientEvidence: z.boolean(),
  baselineValue: z.number().nullable().optional(),
  currentValue: z.number().nullable().optional(),
  delta: z.number().nullable().optional(),
  relatedFindingIds: z.array(z.string()),
  generatedAt: z.string(),
});

export const strategyReportSchema = z.object({
  reportId: z.string(),
  runId: z.string(),
  agentType: strategyAgentTypeSchema,
  cadence: strategyAgentCadenceSchema,
  reportName: z.string(),
  timeRange: z.string(),
  periodStart: z.string(),
  periodEnd: z.string(),
  headline: z.string(),
  summary: z.string(),
  keyInsights: z.array(z.string()),
  drivers: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  impactLevel: strategyImpactLevelSchema,
  entities: z.array(strategyEntitySchema),
  signals: z.array(strategySignalSchema),
  signalCount: z.number().int().nonnegative(),
  reasoningLog: z.array(strategyReasoningEntrySchema),
  predictions: z.array(strategyPredictionReferenceSchema),
  decisions: z.array(strategyDecisionSchema),
  relatedFindingIds: z.array(z.string()),
  insufficientEvidence: z.boolean(),
  baselineGeneratedAt: z.string().nullable().optional(),
  generatedAt: z.string(),
});

export const strategyMemoryEntrySchema = z.object({
  entity: strategyEntitySchema,
  score: z.number(),
  confidence: z.number().min(0).max(1),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export const strategyMemorySnapshotSchema = z.object({
  snapshotId: z.string(),
  agentType: strategyAgentTypeSchema,
  generatedAt: z.string(),
  entries: z.array(strategyMemoryEntrySchema),
});

export const strategyAgentStatusSchema = z.object({
  agentType: strategyAgentTypeSchema,
  cadence: strategyAgentCadenceSchema,
  description: z.string(),
  defaultTimeRange: z.string(),
  schedule: z.string(),
  inProgress: z.boolean(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string().nullable(),
  lastReportId: z.string().nullable(),
  lastImpactLevel: strategyImpactLevelSchema.nullable(),
  lastError: z.string().nullable(),
});

export const strategyAgentRunResultSchema = z.object({
  agentType: strategyAgentTypeSchema,
  runId: z.string(),
  report: strategyReportSchema,
  insights: z.array(strategyInsightSchema),
  publishedFindings: z.array(strategyFindingReferenceSchema),
});

export const strategyAgentListResponseSchema = z.object({
  schema: z.string(),
  scheduler: z.object({
    running: z.boolean(),
    agentCount: z.number().int().nonnegative(),
  }),
  agents: z.array(strategyAgentStatusSchema),
  generatedAt: z.string(),
});

export const strategyAgentReportListResponseSchema = z.object({
  schema: z.string(),
  total: z.number().int().nonnegative(),
  reports: z.array(strategyReportSchema),
  filters: z.object({
    agentType: strategyAgentTypeSchema.optional(),
    timeRange: z.string().optional(),
    impactLevel: strategyImpactLevelSchema.optional(),
  }),
  generatedAt: z.string(),
});

export const strategyAgentInsightListResponseSchema = z.object({
  schema: z.string(),
  total: z.number().int().nonnegative(),
  insights: z.array(strategyInsightSchema),
  filters: z.object({
    agentType: strategyAgentTypeSchema.optional(),
    timeRange: z.string().optional(),
    impactLevel: strategyImpactLevelSchema.optional(),
  }),
  generatedAt: z.string(),
});

export const strategyAgentRunResponseSchema = z.object({
  schema: z.string(),
  runs: z.array(strategyAgentRunResultSchema),
  generatedAt: z.string(),
});

export type StrategyAgentType = z.infer<typeof strategyAgentTypeSchema>;
export type StrategyAgentCadence = z.infer<typeof strategyAgentCadenceSchema>;
export type StrategyImpactLevel = z.infer<typeof strategyImpactLevelSchema>;
export type StrategyEntity = z.infer<typeof strategyEntitySchema>;
export type StrategySignal = z.infer<typeof strategySignalSchema>;
export type StrategyReasoningEntry = z.infer<typeof strategyReasoningEntrySchema>;
export type StrategyPredictionReference = z.infer<typeof strategyPredictionReferenceSchema>;
export type StrategyFindingReference = z.infer<typeof strategyFindingReferenceSchema>;
export type StrategyDecision = z.infer<typeof strategyDecisionSchema>;
export type StrategyInsight = z.infer<typeof strategyInsightSchema>;
export type StrategyReport = z.infer<typeof strategyReportSchema>;
export type StrategyMemorySnapshot = z.infer<typeof strategyMemorySnapshotSchema>;
export type StrategyAgentStatus = z.infer<typeof strategyAgentStatusSchema>;
export type StrategyAgentRunResult = z.infer<typeof strategyAgentRunResultSchema>;
