import { NCIVerifiableProofType } from '@prisma/client';
import { z } from 'zod';
import type { JobQueueRecord, JobQueueType } from '../models/JobQueue.js';

type SchemaFor<T extends JobQueueType> = z.ZodTypeAny;

export const jobPayloadSchemas: Record<JobQueueType, SchemaFor<JobQueueType>> = {
  PSV_RUN: z
    .object({
      clinicianId: z.string().min(1, 'clinicianId is required'),
      npi: z.string().min(1, 'npi is required'),
      state: z.string().min(2).max(2),
      licenseNumber: z.string().min(1, 'licenseNumber is required'),
    })
    .strict(),
  SEND_EMAIL: z
    .object({
      batchSize: z.number().int().positive().max(200).optional(),
    })
    .strict(),
  RUN_PILOT_SMOKE: z.object({}).strict(),
  SYNC_METRICS: z
    .object({
      label: z.string().optional(),
    })
    .strict(),
  PRIVILEGE_ISSUE: z
    .object({
      privilegeRequestId: z.string().min(1, 'privilegeRequestId is required'),
      privilegeGrantedId: z.string().min(1, 'privilegeGrantedId is required'),
      clinicianDid: z.string().min(1, 'clinicianDid is required'),
      orgId: z.string().min(1, 'orgId is required'),
      privilegeSetId: z.string().min(1, 'privilegeSetId is required'),
      reviewerDid: z.string().min(1, 'reviewerDid is required'),
    })
    .strict(),
  CREDENTIAL_AGENT_TASK: z
    .object({
      taskId: z.string().min(1, 'taskId is required'),
    })
    .strict(),
  EHR_SYNC: z
    .object({
      syncId: z.string().min(1, 'syncId is required'),
    })
    .strict(),
  FHIR_SUBSCRIPTION_DELIVER: z
    .object({
      subscriptionId: z.string().min(1, 'subscriptionId is required'),
      resourceType: z.literal('Practitioner'),
      resourceId: z.string().min(1, 'resourceId is required'),
      eventType: z.enum(['update', 'delete']).optional(),
    })
    .strict(),
  DRIFT_SWEEP: z.object({}).strict(),
  NCI_PUBLISH_PROOFS: z
    .object({
      clinicianId: z.string().min(1, 'clinicianId is required'),
      proofTypes: z
        .array(z.nativeEnum(NCIVerifiableProofType))
        .min(1, 'proofTypes must include at least one entry'),
    })
    .strict(),
  FUSION_UPDATE: z
    .object({
      clinicianId: z.string().min(1, 'clinicianId is required'),
    })
    .strict(),
  SAFETY_SWEEP: z
    .object({
      clinicianId: z.string().min(1, 'clinicianId must be provided when set').optional(),
    })
    .strict(),
  MOBILITY_EVALUATE_ORG: z
    .object({
      onboardingRequestId: z.string().min(1, 'onboardingRequestId is required'),
    })
    .strict(),
  SUPERVISOR_RUN: z
    .object({
      orgId: z.string().min(1, 'orgId is required'),
      clinicianId: z.string().min(1, 'clinicianId is required').optional(),
    })
    .strict(),
};

export type JobPayloadMap = {
  [K in JobQueueType]: z.infer<typeof jobPayloadSchemas[K]>;
};

export class JobPayloadValidationError extends Error {
  public readonly issues: z.ZodIssue[];
  public readonly jobId: string;
  public readonly jobType: JobQueueType;

  constructor(job: JobQueueRecord, issues: z.ZodIssue[]) {
    super(`Invalid payload for job ${job.id} (${job.type})`);
    this.name = 'JobPayloadValidationError';
    this.jobId = job.id;
    this.jobType = job.type as JobQueueType;
    this.issues = issues;
  }
}

export interface JobPayloadValidationResult {
  success: boolean;
  error?: JobPayloadValidationError;
}

export function validateJobPayload(job: JobQueueRecord): JobPayloadValidationResult {
  const schema = jobPayloadSchemas[job.type as JobQueueType];

  if (!schema) {
    return { success: true };
  }

  const result = schema.safeParse(job.payload);
  if (result.success) {
    return { success: true };
  }

  return {
    success: false,
    error: new JobPayloadValidationError(job, result.error.issues),
  };
}

export function parseJobPayload<T extends JobQueueType>(
  job: JobQueueRecord,
  expectedType: T,
): JobPayloadMap[T] {
  if (job.type !== expectedType) {
    throw new Error(`Job type mismatch: expected ${expectedType} but got ${job.type}`);
  }

  const schema = jobPayloadSchemas[expectedType];
  if (!schema) {
    return job.payload as JobPayloadMap[T];
  }

  return schema.parse(job.payload);
}

