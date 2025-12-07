import type { CompactParticipationStatus, CompactType } from '../models/CompactParticipation.js';
import { US_STATE_CODES } from '../models/CompactParticipation.js';
import { IMLC_STATES } from '../models/IMLCEligibility.js';
import { PSYPACT_STATES } from '../models/Psycompact.js';

export interface CompactParticipationSeedRecord {
  state: string;
  status: CompactParticipationStatus;
  startDate?: string;
  metadata?: Record<string, unknown>;
}

export type CompactParticipationSeedMap = Record<CompactType, CompactParticipationSeedRecord[]>;

const DEFAULT_BASE_YEAR: Record<CompactType, number> = {
  IMLC: 2017,
  PSYPACT: 2020,
  NLC: 2000,
  APRN: 2024,
  PT: 2018,
};

const NLC_ACTIVE_STATES = [
  'AL', 'AZ', 'AR', 'CO', 'DE', 'FL', 'GA', 'ID', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MS',
  'MO', 'MT', 'NE', 'NH', 'NJ', 'NM', 'NC', 'ND', 'OH', 'OK', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA',
  'WA', 'WV', 'WI', 'WY',
] as const;

const PT_ACTIVE_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NC',
  'ND', 'OH', 'OK', 'OR', 'PA', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'VT', 'WA', 'WI', 'WV', 'WY',
] as const;

const APRN_ACTIVE_STATES = [
  'AZ', 'AR', 'CO', 'DE', 'GA', 'ID', 'IN', 'IA', 'KY', 'MD', 'MS', 'MO', 'NC', 'ND', 'OK', 'SD',
  'TN', 'TX', 'UT', 'VA', 'WA', 'WV', 'WY',
] as const;

const APRN_SUSPENDED_STATES = ['NM'] as const;

const APRN_METADATA_OVERRIDES: Record<string, Record<string, unknown>> = {
  TX: { requiresResidency: true, waitingPeriodDays: 30, requiresRNCompact: true },
  UT: { requiresResidency: true, waitingPeriodDays: 45 },
  WA: { requiresResidency: true, waitingPeriodDays: 60 },
  VA: { requiresResidency: true },
  NC: { requiresResidency: true, requiresRNCompact: true, waitingPeriodDays: 30 },
  WY: { requiresResidency: false, waitingPeriodDays: 15 },
};

export const COMPACT_STATE_PARTICIPATION_SEED_DATA: CompactParticipationSeedMap = {
  IMLC: buildParticipationSeeds('IMLC', IMLC_STATES),
  PSYPACT: buildParticipationSeeds('PSYPACT', PSYPACT_STATES),
  NLC: buildParticipationSeeds('NLC', NLC_ACTIVE_STATES),
  PT: buildParticipationSeeds('PT', PT_ACTIVE_STATES),
  APRN: buildParticipationSeeds('APRN', APRN_ACTIVE_STATES, APRN_SUSPENDED_STATES, APRN_METADATA_OVERRIDES),
};

export function flattenSeedData(map: CompactParticipationSeedMap = COMPACT_STATE_PARTICIPATION_SEED_DATA) {
  return Object.entries(map).flatMap(([compactType, records]) =>
    records.map((record) => ({ compactType: compactType as CompactType, ...record })),
  );
}

function buildParticipationSeeds(
  compactType: CompactType,
  activeStates: readonly string[],
  suspendedStates: readonly string[] = [],
  metadataOverrides: Record<string, Record<string, unknown>> = {},
): CompactParticipationSeedRecord[] {
  const baseYear = DEFAULT_BASE_YEAR[compactType];
  return US_STATE_CODES.map((state, index) => {
    const normalized = state.toUpperCase();
    let status: CompactParticipationStatus = 'ORGANIZATIONAL_ONLY';
    if (suspendedStates.includes(normalized)) {
      status = 'SUSPENDED';
    } else if (activeStates.includes(normalized)) {
      status = 'ACTIVE';
    }
    return {
      state: normalized,
      status,
      startDate: status === 'ACTIVE' ? rolloutDate(baseYear, index) : undefined,
      metadata: metadataOverrides[normalized],
    };
  });
}

function rolloutDate(baseYear: number, index: number): string {
  const year = baseYear + Math.floor(index / 12);
  const month = index % 12;
  return new Date(Date.UTC(year, month, 1)).toISOString();
}

