import { z } from 'zod';

const RULE_CODES = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'] as const;
export const NCQARuleCodeSchema = z.enum(RULE_CODES);
export type NCQARuleCode = z.infer<typeof NCQARuleCodeSchema>;

const STATUS_VALUES = ['PASS', 'FAIL', 'WARN', 'PENDING'] as const;
export const NCQAComplianceStatusSchema = z.enum(STATUS_VALUES);
export type NCQAComplianceStatus = z.infer<typeof NCQAComplianceStatusSchema>;

const EVIDENCE_TYPES = ['PSV_RESULT', 'LICENSE', 'BOARD_CERT', 'RIGHTS_NOTICE', 'FILE_AUDIT', 'OPPE'] as const;
export const NCQAEvidenceReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(EVIDENCE_TYPES),
  label: z.string(),
  uri: z.string(),
  capturedAt: z.date().optional(),
  hash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type NCQAEvidenceReference = z.infer<typeof NCQAEvidenceReferenceSchema>;

export interface NCQAComplianceRecordInput {
  clinicianId: string;
  ruleCode: NCQARuleCode;
  status: NCQAComplianceStatus;
  lastVerifiedAt: Date | null;
  nextDueAt: Date | null;
  evidenceRefs?: NCQAEvidenceReference[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type ComplianceSeverity = 'info' | 'warning' | 'critical';

export interface NormalizedNCQAComplianceRecord extends NCQAComplianceRecordInput {
  id: string;
  assessedAt: Date;
  evidenceRefs: NCQAEvidenceReference[];
  notes: string;
  severity: ComplianceSeverity;
}

function toSeverity(status: NCQAComplianceStatus): ComplianceSeverity {
  if (status === 'FAIL') {
    return 'critical';
  }
  if (status === 'WARN') {
    return 'warning';
  }
  return 'info';
}

export function normalizeNCQAComplianceRecord(
  input: NCQAComplianceRecordInput
): NormalizedNCQAComplianceRecord {
  const parsedStatus = NCQAComplianceStatusSchema.parse(input.status);
  const parsedRule = NCQARuleCodeSchema.parse(input.ruleCode);
  const evidenceRefs = (input.evidenceRefs ?? []).map(ref => NCQAEvidenceReferenceSchema.parse(ref));

  return {
    clinicianId: input.clinicianId,
    ruleCode: parsedRule,
    status: parsedStatus,
    lastVerifiedAt: input.lastVerifiedAt ?? null,
    nextDueAt: input.nextDueAt ?? null,
    evidenceRefs,
    notes: input.notes ?? '',
    metadata: input.metadata,
    id: `${input.clinicianId}-${parsedRule}`,
    assessedAt: new Date(),
    severity: toSeverity(parsedStatus),
  };
}

export function shouldAlertOnCompliance(record: { status: NCQAComplianceStatus }): boolean {
  return record.status === 'FAIL' || record.status === 'WARN';
}

import { z } from 'zod';

const RULE_CODES = ['CR1', 'CR2', 'CR3', 'CR4', 'CR5'] as const;
export const NCQARuleCodeSchema = z.enum(RULE_CODES);
export type NCQARuleCode = z.infer<typeof NCQARuleCodeSchema>;

const STATUS_VALUES = ['PASS', 'FAIL', 'WARN', 'PENDING'] as const;
export const NCQAComplianceStatusSchema = z.enum(STATUS_VALUES);
export type NCQAComplianceStatus = z.infer<typeof NCQAComplianceStatusSchema>;

const EVIDENCE_TYPES = ['PSV_RESULT', 'LICENSE', 'BOARD_CERT', 'RIGHTS_NOTICE', 'FILE_AUDIT', 'OPPE'] as const;
export const NCQAEvidenceReferenceSchema = z.object({
  id: z.string(),
  type: z.enum(EVIDENCE_TYPES),
  label: z.string(),
  uri: z.string(),
  capturedAt: z.date().optional(),
  hash: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});
export type NCQAEvidenceReference = z.infer<typeof NCQAEvidenceReferenceSchema>;

export interface NCQAComplianceRecordInput {
  clinicianId: string;
  ruleCode: NCQARuleCode;
  status: NCQAComplianceStatus;
  lastVerifiedAt: Date | null;
  nextDueAt: Date | null;
  evidenceRefs?: NCQAEvidenceReference[];
  notes?: string;
  metadata?: Record<string, unknown>;
}

export type ComplianceSeverity = 'info' | 'warning' | 'critical';

export interface NormalizedNCQAComplianceRecord extends NCQAComplianceRecordInput {
  id: string;
  assessedAt: Date;
  evidenceRefs: NCQAEvidenceReference[];
  notes: string;
  severity: ComplianceSeverity;
}

function toSeverity(status: NCQAComplianceStatus): ComplianceSeverity {
  if (status === 'FAIL') {
    return 'critical';
  }
  if (status === 'WARN') {
    return 'warning';
  }
  return 'info';
}

export function normalizeNCQAComplianceRecord(
  input: NCQAComplianceRecordInput
): NormalizedNCQAComplianceRecord {
  const parsedStatus = NCQAComplianceStatusSchema.parse(input.status);
  const parsedRule = NCQARuleCodeSchema.parse(input.ruleCode);
  const evidenceRefs = (input.evidenceRefs ?? []).map(ref => NCQAEvidenceReferenceSchema.parse(ref));

  return {
    clinicianId: input.clinicianId,
    ruleCode: parsedRule,
    status: parsedStatus,
    lastVerifiedAt: input.lastVerifiedAt ?? null,
    nextDueAt: input.nextDueAt ?? null,
    evidenceRefs,
    notes: input.notes ?? '',
    metadata: input.metadata,
    id: `${input.clinicianId}-${parsedRule}`,
    assessedAt: new Date(),
    severity: toSeverity(parsedStatus),
  };
}

export function shouldAlertOnCompliance(record: { status: NCQAComplianceStatus }): boolean {
  return record.status === 'FAIL' || record.status === 'WARN';
}

import { z } from 'zod';

export const NCQARuleCodeSchema = z.enum(['CR1', 'CR2', 'CR3', 'CR4', 'CR5']);
export type NCQARuleCode = z.infer<typeof NCQARuleCodeSchema>;

export const NCQA_RULE_LABELS: Record<NCQARuleCode, string> = {
  CR1: 'Credentialing primary source verification',
  CR2: 'Recredentialing cycle + PSV refresh',
  CR3: 'Practitioner rights acknowledgements',
  CR4: 'Delegated credentialing oversight',
  CR5: 'Ongoing professional practice evaluation',
};

export const NCQAComplianceStatusSchema = z.enum(['PASS', 'FAIL', 'WARN', 'PENDING']);
export type NCQAComplianceStatus = z.infer<typeof NCQAComplianceStatusSchema>;

export const NCQAEvidenceTypeSchema = z.enum([
  'PSV_RESULT',
  'LICENSE',
  'BOARD_CERT',
  'DEA',
  'SANCTIONS',
  'RIGHTS_NOTICE',
  'APPEAL',
  'FILE_AUDIT',
  'DELEGATION_AUDIT',
  'OPPE',
  'FPPE',
  'QUALITY_METRIC',
  'ATTESTATION',
  'OTHER',
]);
export type NCQAEvidenceType = z.infer<typeof NCQAEvidenceTypeSchema>;

export const NCQAEvidenceReferenceSchema = z.object({
  id: z.string().min(1),
  type: NCQAEvidenceTypeSchema.default('OTHER'),
  label: z.string().min(1),
  uri: z.string().min(1),
  source: z.string().optional(),
  hash: z.string().optional(),
  capturedAt: z.union([z.date(), z.string().datetime()]).optional(),
  metadata: z.record(z.any()).optional(),
});
export type NCQAEvidenceReference = z.infer<typeof NCQAEvidenceReferenceSchema>;

export const NCQAComplianceRecordSchema = z.object({
  clinicianId: z.string().min(1),
  ruleCode: NCQARuleCodeSchema,
  status: NCQAComplianceStatusSchema,
  lastVerifiedAt: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  nextDueAt: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  evidenceRefs: z.array(NCQAEvidenceReferenceSchema).max(50).default([]),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type NCQAComplianceRecordInput = z.infer<typeof NCQAComplianceRecordSchema>;

export interface NormalizedNCQAComplianceRecord
  extends Omit<NCQAComplianceRecordInput, 'lastVerifiedAt' | 'nextDueAt'> {
  lastVerifiedAt: Date | null;
  nextDueAt: Date | null;
  evidenceRefs: NCQAEvidenceReference[];
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeNCQAComplianceRecord(
  payload: NCQAComplianceRecordInput | unknown
): NormalizedNCQAComplianceRecord {
  const parsed = NCQAComplianceRecordSchema.parse(payload);
  return {
    ...parsed,
    lastVerifiedAt: toDate(parsed.lastVerifiedAt),
    nextDueAt: toDate(parsed.nextDueAt),
    evidenceRefs: (parsed.evidenceRefs ?? []).map((ref) => ({
      ...ref,
      capturedAt: toDate(ref.capturedAt as Date | string | null) ?? undefined,
    })),
  };
}

export function deriveComplianceUrgency(
  record: NormalizedNCQAComplianceRecord,
  asOf: Date = new Date()
): 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'UNKNOWN' {
  if (!record.nextDueAt) {
    return 'UNKNOWN';
  }
  const msDiff = record.nextDueAt.getTime() - asOf.getTime();
  const days = Math.floor(msDiff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return 'OVERDUE';
  }
  if (days <= 30) {
    return 'DUE_SOON';
  }
  return 'ON_TRACK';
}

export function shouldAlertOnCompliance(record: NormalizedNCQAComplianceRecord): boolean {
  return record.status === 'FAIL' || record.status === 'WARN';
}

export function mergeEvidenceRefs(
  current: NCQAEvidenceReference[],
  next: NCQAEvidenceReference[]
): NCQAEvidenceReference[] {
  const ids = new Set<string>();
  const merged: NCQAEvidenceReference[] = [];

  for (const ref of [...current, ...next]) {
    if (ids.has(ref.id)) continue;
    ids.add(ref.id);
    merged.push(ref);
  }

  return merged.slice(0, 50);
}
import { z } from 'zod';

/**
 * NCQA CR rule codes (CR1–CR5)
 */
export const NCQARuleCodeSchema = z.enum(['CR1', 'CR2', 'CR3', 'CR4', 'CR5']);
export type NCQARuleCode = z.infer<typeof NCQARuleCodeSchema>;

export const NCQA_RULE_LABELS: Record<NCQARuleCode, string> = {
  CR1: 'Credentialing primary source verification',
  CR2: 'Recredentialing cycle + PSV refresh',
  CR3: 'Practitioner rights & notifications',
  CR4: 'Delegated credentialing oversight',
  CR5: 'Ongoing professional practice evaluation',
};

/**
 * Status lifecycle for NCQA rule evaluations
 */
export const NCQAComplianceStatusSchema = z.enum(['PASS', 'FAIL', 'WARN', 'PENDING']);
export type NCQAComplianceStatus = z.infer<typeof NCQAComplianceStatusSchema>;

export const NCQA_STATUS_ORDER: Record<NCQAComplianceStatus, number> = {
  FAIL: 0,
  WARN: 1,
  PENDING: 2,
  PASS: 3,
};

export const NCQAEvidenceTypeSchema = z.enum([
  'PSV_RESULT',
  'LICENSE',
  'BOARD_CERT',
  'DEA',
  'SANCTIONS',
  'RIGHTS_NOTICE',
  'APPEAL',
  'FILE_AUDIT',
  'DELEGATION_AUDIT',
  'OPPE',
  'FPPE',
  'QUALITY_METRIC',
  'ATTESTATION',
  'OTHER',
]);
export type NCQAEvidenceType = z.infer<typeof NCQAEvidenceTypeSchema>;

export const NCQAEvidenceReferenceSchema = z.object({
  id: z.string().min(1, 'evidence id required'),
  type: NCQAEvidenceTypeSchema.default('OTHER'),
  label: z.string().min(1, 'label required'),
  uri: z.string().min(1, 'uri required'),
  source: z.string().optional(),
  hash: z.string().optional(),
  capturedAt: z.union([z.date(), z.string().datetime()]).optional(),
  metadata: z.record(z.any()).optional(),
});
export type NCQAEvidenceReference = z.infer<typeof NCQAEvidenceReferenceSchema>;

export const NCQAComplianceRecordSchema = z.object({
  clinicianId: z.string().min(1, 'clinicianId required'),
  ruleCode: NCQARuleCodeSchema,
  status: NCQAComplianceStatusSchema,
  lastVerifiedAt: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  nextDueAt: z.union([z.date(), z.string().datetime()]).nullable().optional(),
  evidenceRefs: z.array(NCQAEvidenceReferenceSchema).max(50).default([]),
  notes: z.string().max(2000).optional(),
  metadata: z.record(z.any()).optional(),
});

export type NCQAComplianceRecordInput = z.infer<typeof NCQAComplianceRecordSchema>;

export interface NormalizedNCQAComplianceRecord
  extends Omit<NCQAComplianceRecordInput, 'lastVerifiedAt' | 'nextDueAt'> {
  lastVerifiedAt: Date | null;
  nextDueAt: Date | null;
  evidenceRefs: NCQAEvidenceReference[];
}

function toDate(value?: Date | string | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function normalizeNCQAComplianceRecord(
  payload: NCQAComplianceRecordInput | unknown
): NormalizedNCQAComplianceRecord {
  const parsed = NCQAComplianceRecordSchema.parse(payload);
  return {
    ...parsed,
    lastVerifiedAt: toDate(parsed.lastVerifiedAt),
    nextDueAt: toDate(parsed.nextDueAt),
    evidenceRefs: (parsed.evidenceRefs ?? []).map((ref) => ({
      ...ref,
      capturedAt: toDate(ref.capturedAt as Date | string | null) ?? undefined,
    })),
  };
}

export function deriveComplianceUrgency(
  record: NormalizedNCQAComplianceRecord,
  asOf: Date = new Date()
): 'OVERDUE' | 'DUE_SOON' | 'ON_TRACK' | 'UNKNOWN' {
  if (!record.nextDueAt) {
    return 'UNKNOWN';
  }
  const msDiff = record.nextDueAt.getTime() - asOf.getTime();
  const days = Math.floor(msDiff / (1000 * 60 * 60 * 24));

  if (days < 0) {
    return 'OVERDUE';
  }
  if (days <= 30) {
    return 'DUE_SOON';
  }
  return 'ON_TRACK';
}

export function shouldAlertOnCompliance(record: NormalizedNCQAComplianceRecord): boolean {
  return record.status === 'FAIL' || record.status === 'WARN';
}

export function mergeEvidenceRefs(
  current: NCQAEvidenceReference[],
  next: NCQAEvidenceReference[]
): NCQAEvidenceReference[] {
  const ids = new Set<string>();
  const merged: NCQAEvidenceReference[] = [];

  for (const ref of [...current, ...next]) {
    if (ids.has(ref.id)) {
      continue;
    }
    ids.add(ref.id);
    merged.push(ref);
  }

  return merged.slice(0, 50);
}

