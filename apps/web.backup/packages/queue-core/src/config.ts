import { JobDomain, JobType } from './jobTypes';
import { BackoffSettings } from './backoff';

export interface JobTypeConfig {
  domain: JobDomain;
  concurrencyLimit: number;
  defaultMaxAttempts: number;
  backoff: BackoffSettings;
}

const BASE_BACKOFF: BackoffSettings = {
  baseMs: 1_000,
  maxMs: 60_000,
  multiplier: 2,
  jitterRatio: 0.2,
};

export const JOB_TYPE_CONFIG: Record<JobType, JobTypeConfig> = {
  PSV_RUN: {
    domain: 'credentialing',
    concurrencyLimit: 4,
    defaultMaxAttempts: 5,
    backoff: { ...BASE_BACKOFF, maxMs: 120_000 },
  },
  PRIVILEGE_ISSUE: {
    domain: 'privileging',
    concurrencyLimit: 3,
    defaultMaxAttempts: 5,
    backoff: BASE_BACKOFF,
  },
  NPDB_QUERY: {
    domain: 'credentialing',
    concurrencyLimit: 2,
    defaultMaxAttempts: 4,
    backoff: { ...BASE_BACKOFF, baseMs: 2_000, maxMs: 180_000 },
  },
  PECOS_CHECK: {
    domain: 'payer',
    concurrencyLimit: 1,
    defaultMaxAttempts: 4,
    backoff: { ...BASE_BACKOFF, baseMs: 5_000, maxMs: 300_000 },
  },
  FPPE_GENERATE: {
    domain: 'privileging',
    concurrencyLimit: 2,
    defaultMaxAttempts: 3,
    backoff: BASE_BACKOFF,
  },
  OPPE_GENERATE: {
    domain: 'privileging',
    concurrencyLimit: 2,
    defaultMaxAttempts: 3,
    backoff: BASE_BACKOFF,
  },
  EMAIL_SEND: {
    domain: 'directory',
    concurrencyLimit: 12,
    defaultMaxAttempts: 3,
    backoff: { ...BASE_BACKOFF, baseMs: 500, maxMs: 10_000 },
  },
  AUDIT_ANCHOR: {
    domain: 'audit',
    concurrencyLimit: 2,
    defaultMaxAttempts: 5,
    backoff: BASE_BACKOFF,
  },
};

export function getJobConfig(type: JobType): JobTypeConfig {
  return JOB_TYPE_CONFIG[type];
}

export function getJobTypesForDomain(domain: JobDomain): JobType[] {
  return (Object.keys(JOB_TYPE_CONFIG) as JobType[]).filter(
    (jobType) => JOB_TYPE_CONFIG[jobType].domain === domain
  );
}

