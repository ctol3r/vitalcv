import { describe, expect, it } from '@jest/globals';
import { COMPACT_STATE_PARTICIPATION_SEED_DATA } from '../data/stateParticipation.js';
import {
  COMPACT_PARTICIPATION_STATUSES,
  US_STATE_CODES,
} from '../models/CompactParticipation.js';

describe('Compact participation seed data', () => {
  it('covers every state + DC for each compact', () => {
    const totalStates = US_STATE_CODES.length;
    for (const [compactType, records] of Object.entries(COMPACT_STATE_PARTICIPATION_SEED_DATA)) {
      expect(records).toHaveLength(totalStates);
      const seenStates = new Set(records.map((record) => record.state));
      expect(seenStates.size).toBe(totalStates);
      expect(records.some((record) => record.status === 'ACTIVE')).toBe(true);
    }
  });

  it('only uses supported participation statuses', () => {
    const allowed = new Set(COMPACT_PARTICIPATION_STATUSES);
    for (const records of Object.values(COMPACT_STATE_PARTICIPATION_SEED_DATA)) {
      for (const record of records) {
        expect(allowed.has(record.status)).toBe(true);
      }
    }
  });

  it('ensures active states have a start date timestamp', () => {
    for (const records of Object.values(COMPACT_STATE_PARTICIPATION_SEED_DATA)) {
      for (const record of records.filter((r) => r.status === 'ACTIVE')) {
        expect(record.startDate).toBeDefined();
        expect(new Date(record.startDate as string).getTime()).not.toBeNaN();
      }
    }
  });
});
