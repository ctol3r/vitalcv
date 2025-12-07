import type { JobQueueType } from './models/JobQueue.js';
import { jobPayloadSchemas, type JobPayloadMap } from './validation/payloadValidator.js';

type Builder<T extends JobQueueType> = (payload: JobPayloadMap[T]) => string;

const idempotencyBuilders: Partial<Record<JobQueueType, Builder<JobQueueType>>> = {
  PSV_RUN: (payload) =>
    [
      'psv',
      payload.clinicianId,
      payload.state.toUpperCase(),
      payload.licenseNumber,
    ]
      .map((segment) => segment.trim())
      .join(':'),
  PRIVILEGE_ISSUE: (payload) => `privilege:${payload.privilegeGrantedId}`,
  SAFETY_SWEEP: (payload) => `safety-sweep:${payload.clinicianId ?? 'all'}`,
  NCI_PUBLISH_PROOFS: (payload) => {
    const sortedTypes = [...payload.proofTypes].sort().join(',');
    return `nci-proof:${payload.clinicianId}:${sortedTypes}`;
  },
};

export function deriveIdempotencyKey<T extends JobQueueType>(
  type: T,
  payload: unknown,
): string | null {
  const builder = idempotencyBuilders[type];
  if (!builder) {
    return null;
  }

  const schema = jobPayloadSchemas[type];
  if (!schema) {
    return null;
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return null;
  }

  return builder(parsed.data as JobPayloadMap[T]);
}

