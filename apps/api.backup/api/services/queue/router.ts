import { z } from 'zod';
import { JOB_QUEUE_TYPES, JobQueueType } from './models/JobQueue.js';
import { jobPayloadSchemas } from './validation/payloadValidator.js';
import { getJobHandler, type JobHandler } from './handlers/index.js';

export type QueueConcurrency =
  | { mode: 'unbounded' }
  | { mode: 'global'; limit: number }
  | { mode: 'keyed'; key: string; description?: string };

export interface QueueRoute {
  type: JobQueueType;
  description: string;
  category: string;
  concurrency: QueueConcurrency;
  schema: z.ZodTypeAny;
  handler: JobHandler;
  critical?: boolean;
}

interface RouteMetadata extends Omit<QueueRoute, 'handler' | 'schema' | 'type'> {}

const routeMetadata: Record<JobQueueType, RouteMetadata> = {
  PSV_RUN: {
    description: 'Primary source verification orchestrations',
    category: 'psv',
    concurrency: { mode: 'unbounded' },
  },
  SEND_EMAIL: {
    description: 'Batch notification sender',
    category: 'notifications',
    concurrency: { mode: 'unbounded' },
  },
  RUN_PILOT_SMOKE: {
    description: 'Pilot smoke-test executor',
    category: 'pilot',
    concurrency: { mode: 'global', limit: 1 },
  },
  SYNC_METRICS: {
    description: 'Demo dashboard metric snapshot',
    category: 'metrics',
    concurrency: { mode: 'unbounded' },
  },
  PRIVILEGE_ISSUE: {
    description: 'Privilege credential issuance pipeline',
    category: 'privileging',
    concurrency: { mode: 'unbounded' },
  },
  CREDENTIAL_AGENT_TASK: {
    description: 'Background agent task runner',
    category: 'agents',
    concurrency: { mode: 'unbounded' },
  },
  EHR_SYNC: {
    description: 'EHR synchronization worker',
    category: 'ehr',
    concurrency: { mode: 'keyed', key: 'syncId', description: 'Per-sync lock enforced in handler' },
  },
  FHIR_SUBSCRIPTION_DELIVER: {
    description: 'FHIR R6 subscription delivery',
    category: 'fhir',
    concurrency: { mode: 'unbounded' },
  },
  DRIFT_SWEEP: {
    description: 'Credential drift detection sweep',
    category: 'risk',
    concurrency: { mode: 'global', limit: 1 },
  },
  FUSION_UPDATE: {
    description: 'Fusion quality signal aggregation',
    category: 'fusion',
    concurrency: { mode: 'global', limit: 2 },
    critical: true,
  },
  SAFETY_SWEEP: {
    description: 'Safety signal ingestion sweep',
    category: 'safety',
    concurrency: { mode: 'global', limit: 1 },
    critical: true,
  },
  MOBILITY_EVALUATE_ORG: {
    description: 'Mobility readiness evaluation',
    category: 'mobility',
    concurrency: { mode: 'keyed', key: 'targetOrgId', description: 'One evaluation per target org' },
    critical: true,
  },
  NCI_PUBLISH_PROOFS: {
    description: 'NCI verifiable proof publisher',
    category: 'nci',
    concurrency: { mode: 'keyed', key: 'clinicianId', description: 'Serial per clinician' },
    critical: true,
  },
};

export class MissingQueueRouteError extends Error {
  constructor(type: string) {
    super(`No route registered for queue type ${type}`);
    this.name = 'MissingQueueRouteError';
  }
}

export function resolveQueueRoute(type: JobQueueType): QueueRoute {
  const metadata = routeMetadata[type];
  if (!metadata) {
    throw new MissingQueueRouteError(type);
  }

  const schema = jobPayloadSchemas[type];
  if (!schema) {
    throw new MissingQueueRouteError(`${type} (schema missing)`);
  }

  const handler = getJobHandler(type);
  if (!handler) {
    throw new MissingQueueRouteError(`${type} (handler missing)`);
  }

  return {
    type,
    schema,
    handler,
    ...metadata,
  };
}

export function listQueueRoutes(): QueueRoute[] {
  return JOB_QUEUE_TYPES.map((type) => resolveQueueRoute(type));
}
