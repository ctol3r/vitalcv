import { z } from 'zod';
import { JobType } from './jobTypes';

const psvRunSchema = z.object({
  clinicianId: z.string(),
  clinicianDid: z.string().optional(),
  orgId: z.string().optional(),
  npi: z.string().min(10).max(10),
  state: z.string().length(2),
  licenseNumber: z.string().min(3),
});

const privilegeIssueSchema = z.object({
  privilegeRequestId: z.string(),
  privilegeGrantedId: z.string(),
  clinicianDid: z.string(),
  orgId: z.string(),
  privilegeSetId: z.string(),
  reviewerDid: z.string(),
});

const npdbQuerySchema = z.object({
  clinicianId: z.string(),
  clinicianDid: z.string().optional(),
  npi: z.string().min(10).max(10),
  reason: z.string().min(3),
  requestedBy: z.string(),
});

const pecosCheckSchema = z.object({
  enrollmentId: z.string(),
  clinicianDid: z.string(),
  orgId: z.string(),
  trigger: z.enum(['scheduled', 'manual']).default('scheduled'),
});

const fppeGenerateSchema = z.object({
  privilegeGrantedId: z.string(),
  clinicianDid: z.string(),
  orgId: z.string(),
  reviewerId: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

const oppeGenerateSchema = z.object({
  clinicianDid: z.string(),
  orgId: z.string(),
  measurementWindowStart: z.string().datetime(),
  measurementWindowEnd: z.string().datetime(),
});

const emailSendSchema = z.object({
  batchSize: z.number().int().positive().max(500).optional(),
});

const auditAnchorSchema = z.object({
  eventId: z.string(),
  anchorType: z.enum(['sha256', 'polkadot']).default('sha256'),
  payloadHash: z.string().min(16),
  metadata: z.record(z.any()).optional(),
});

const schemaMap = {
  PSV_RUN: psvRunSchema,
  PRIVILEGE_ISSUE: privilegeIssueSchema,
  NPDB_QUERY: npdbQuerySchema,
  PECOS_CHECK: pecosCheckSchema,
  FPPE_GENERATE: fppeGenerateSchema,
  OPPE_GENERATE: oppeGenerateSchema,
  EMAIL_SEND: emailSendSchema,
  AUDIT_ANCHOR: auditAnchorSchema,
} satisfies Record<JobType, z.ZodTypeAny>;

export type JobPayloadMap = {
  [K in JobType]: z.infer<(typeof schemaMap)[K]>;
};

export type JobPayload<T extends JobType> = JobPayloadMap[T];

export function getJobSchema<T extends JobType>(type: T) {
  return schemaMap[type];
}

export function validateJobPayload<T extends JobType>(
  type: T,
  payload: unknown
): JobPayload<T> {
  const schema = getJobSchema(type);
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `Invalid payload for job type ${type}: ${result.error.message}`
    );
  }
  return result.data;
}

