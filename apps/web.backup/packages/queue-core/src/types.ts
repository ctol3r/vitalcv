import type { JobQueue, JobQueueDeadLetter } from '@prisma/client';
import type { JobPayload, JobPayloadMap } from './schemas';
import type { JobType } from './jobTypes';

export type JobQueueRecord = JobQueue;
export type DeadLetterRecord = JobQueueDeadLetter;

export type JobHandler<T extends JobType = JobType> = (
  job: JobQueueRecord,
  payload: JobPayloadMap[T]
) => Promise<void>;

export type ExtractPayload<T extends JobType> = JobPayload<T>;

