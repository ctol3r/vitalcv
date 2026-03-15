import { z } from 'zod';

export const storylineTypeSchema = z.enum([
  'trust decline',
  'rising investigator',
  'network emergence',
  'compliance risk',
  'workforce opportunity',
  'institution shift',
  'industry influence',
]);

export const storylineSeveritySchema = z.enum([
  'info',
  'low',
  'medium',
  'high',
  'critical',
]);

export const storylineStatusSchema = z.enum([
  'active',
  'quiet',
  'escalated',
  'resolved',
  'archived',
]);

export const storylinePerspectiveSchema = z.enum([
  'provider',
  'institution',
  'network',
]);

export const storylineTimelineEventTypeSchema = z.enum([
  'origin',
  'update',
  'quiet_period',
  'reactivated',
  'resolved',
  'escalated',
  'archived',
  'acknowledged',
  'investigation_saved',
]);

export const storylineEvidenceSchema = z.object({
  bullet: z.string(),
  source: z.string(),
  confidence: z.number(),
  observedAt: z.string(),
  findingId: z.string().optional(),
  artifactId: z.string().optional(),
});

export const storylineTimelineEventSchema = z.object({
  eventKey: z.string(),
  type: storylineTimelineEventTypeSchema,
  summary: z.string(),
  occurredAt: z.string(),
  findingIds: z.array(z.string()),
  fromStatus: storylineStatusSchema.optional(),
  toStatus: storylineStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()),
});

export const storylineTimelineSchema = z.object({
  originEvent: storylineTimelineEventSchema,
  events: z.array(storylineTimelineEventSchema),
  quietPeriods: z.number().int().nonnegative(),
  reactivations: z.number().int().nonnegative(),
  lastEventAt: z.string(),
  lastActivityAt: z.string(),
  currentStatus: storylineStatusSchema,
});

export const storylineSchema = z.object({
  storylineId: z.string(),
  fingerprint: z.string(),
  storylineType: storylineTypeSchema,
  perspective: storylinePerspectiveSchema,
  title: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  recommendedActions: z.array(z.string()),
  severity: storylineSeveritySchema,
  confidence: z.number(),
  entityIds: z.array(z.string()),
  findingIds: z.array(z.string()),
  supportingEvidence: z.array(storylineEvidenceSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastActivityAt: z.string(),
  status: storylineStatusSchema,
  progressionScore: z.number(),
  noveltyScore: z.number(),
  persistenceScore: z.number(),
  escalationThreshold: z.number(),
  timeline: storylineTimelineSchema,
  metadata: z.record(z.string(), z.unknown()),
});

export const storylineFindingLinkSchema = z.object({
  findingId: z.string(),
  findingCategory: z.string(),
  findingSeverity: storylineSeveritySchema,
  observedAt: z.string(),
  weight: z.number(),
  snapshot: z.record(z.string(), z.unknown()),
});

export const storylineEntityLinkSchema = z.object({
  entityType: z.enum(['provider', 'institution', 'network', 'generic']),
  entityKey: z.string(),
  entityLabel: z.string().nullable(),
  weight: z.number(),
  firstSeenAt: z.string(),
  lastSeenAt: z.string(),
});

export const storylineActionEventSchema = z.object({
  eventKey: z.string(),
  actionType: z.enum(['acknowledge', 'escalate', 'archive', 'save_investigation']),
  actorId: z.string().nullable(),
  note: z.string().nullable(),
  payload: z.record(z.string(), z.unknown()),
  occurredAt: z.string(),
});

export const storylineListResponseSchema = z.object({
  storylines: z.array(storylineSchema),
  total: z.number().int().nonnegative(),
  syncedAt: z.string(),
});

export const storylineDetailResponseSchema = z.object({
  storyline: storylineSchema,
  findingLinks: z.array(storylineFindingLinkSchema),
  entityLinks: z.array(storylineEntityLinkSchema),
  statusEvents: z.array(storylineTimelineEventSchema),
  actionEvents: z.array(storylineActionEventSchema),
});

export type StorylineContract = z.infer<typeof storylineSchema>;
export type StorylineDetailContract = z.infer<typeof storylineDetailResponseSchema>;
