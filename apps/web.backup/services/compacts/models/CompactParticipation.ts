import { z } from 'zod';

export const COMPACT_TYPES = ['IMLC', 'NLC', 'PSYPACT', 'APRN', 'PT'] as const;
export const CompactTypeEnum = z.enum(COMPACT_TYPES);
export type CompactType = z.infer<typeof CompactTypeEnum>;

export const COMPACT_PARTICIPATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'ORGANIZATIONAL_ONLY'] as const;
export const CompactParticipationStatusEnum = z.enum(COMPACT_PARTICIPATION_STATUSES);
export type CompactParticipationStatus = z.infer<typeof CompactParticipationStatusEnum>;

export const US_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI',
  'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN',
  'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH',
  'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA',
  'WI', 'WV', 'WY',
] as const;
export type USStateCode = typeof US_STATE_CODES[number];

export const CompactParticipationSchema = z.object({
  compactType: CompactTypeEnum,
  state: z.string().length(2, 'State must be a 2-letter postal abbreviation').transform(normalizeStateCode),
  status: CompactParticipationStatusEnum,
  startDate: z.string().datetime().or(z.date()).optional(),
  suspensionDate: z.string().datetime().or(z.date()).optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.string().datetime().or(z.date()).optional(),
  updatedAt: z.string().datetime().or(z.date()).optional(),
});

export type CompactParticipationRecord = z.infer<typeof CompactParticipationSchema>;

export type CompactParticipationIndex = Record<CompactType, Record<string, CompactParticipationRecord>>;

export function normalizeStateCode(state: string): string {
  return state.trim().toUpperCase();
}

export function isValidUSState(state: string): state is USStateCode {
  return US_STATE_CODES.includes(normalizeStateCode(state) as USStateCode);
}

export function buildParticipationIndex(records: CompactParticipationRecord[]): CompactParticipationIndex {
  const index = {} as CompactParticipationIndex;
  for (const record of records) {
    const compactBucket = index[record.compactType] ?? {};
    compactBucket[record.state] = record;
    index[record.compactType] = compactBucket;
  }
  return index;
}

export function getStatesByStatus(
  records: CompactParticipationRecord[],
  status: CompactParticipationStatus = 'ACTIVE',
): string[] {
  return records
    .filter((record) => record.status === status)
    .map((record) => record.state);
}

export function summarizeParticipation(records: CompactParticipationRecord[]) {
  const summary = new Map<CompactType, { active: number; suspended: number; organizational: number }>();
  for (const record of records) {
    if (!summary.has(record.compactType)) {
      summary.set(record.compactType, { active: 0, suspended: 0, organizational: 0 });
    }
    const bucket = summary.get(record.compactType)!;
    if (record.status === 'ACTIVE') bucket.active += 1;
    if (record.status === 'SUSPENDED') bucket.suspended += 1;
    if (record.status === 'ORGANIZATIONAL_ONLY') bucket.organizational += 1;
  }
  return summary;
}

