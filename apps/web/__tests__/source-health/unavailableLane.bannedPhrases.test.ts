import { describe, expect, it } from 'vitest';

import {
  ALL_SOURCE_HEALTH_STATES,
  ALL_SOURCE_IDS,
  type SourceHealthState,
} from '@/lib/source-health/sourceHealthTypes';
import {
  BANNED_USER_FACING_PHRASES,
  unavailableLane,
} from '@/lib/source-health/unavailableLane';

describe('unavailableLane banned-phrase contract', () => {
  for (const sourceId of ALL_SOURCE_IDS) {
    for (const state of ALL_SOURCE_HEALTH_STATES) {
      if (state === 'LIVE') continue;
      it(`(${sourceId}, ${state}) contains no banned phrase`, () => {
        const lane = unavailableLane({
          sourceId,
          state: state as Exclude<SourceHealthState, 'LIVE'>,
          reason: 'banned_phrase_test',
          lastSeenAt: null,
        });
        const haystack = lane.userFacingMessage.toLowerCase();
        for (const phrase of BANNED_USER_FACING_PHRASES) {
          expect(haystack.includes(phrase.toLowerCase())).toBe(false);
        }
      });
    }
  }

  it('exhaustively rejects every banned phrase across all (sourceId, state) pairs', () => {
    const failures: string[] = [];
    for (const sourceId of ALL_SOURCE_IDS) {
      for (const state of ALL_SOURCE_HEALTH_STATES) {
        if (state === 'LIVE') continue;
        const lane = unavailableLane({
          sourceId,
          state: state as Exclude<SourceHealthState, 'LIVE'>,
          reason: 'banned_phrase_test',
          lastSeenAt: null,
        });
        const haystack = lane.userFacingMessage.toLowerCase();
        for (const phrase of BANNED_USER_FACING_PHRASES) {
          if (haystack.includes(phrase.toLowerCase())) {
            failures.push(
              `(${sourceId}, ${state}) leaked banned phrase "${phrase}" in: ${lane.userFacingMessage}`,
            );
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });
});
