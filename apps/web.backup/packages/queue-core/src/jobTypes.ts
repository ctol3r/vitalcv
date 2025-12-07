export const JOB_TYPES = [
  'PSV_RUN',
  'PRIVILEGE_ISSUE',
  'NPDB_QUERY',
  'PECOS_CHECK',
  'FPPE_GENERATE',
  'OPPE_GENERATE',
  'EMAIL_SEND',
  'AUDIT_ANCHOR',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const JOB_DOMAINS = [
  'credentialing',
  'privileging',
  'payer',
  'directory',
  'audit',
] as const;

export type JobDomain = (typeof JOB_DOMAINS)[number];

export function isJobType(input: string): input is JobType {
  return (JOB_TYPES as readonly string[]).includes(input);
}

