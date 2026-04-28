import { describe, expect, it } from 'vitest';

import {
  ALL_SOURCE_HEALTH_STATES,
  ALL_SOURCE_IDS,
  canEvidenceBeUpgraded,
  isHealthy,
  type SourceHealthState,
  type SourceId,
} from '@/lib/source-health/sourceHealthTypes';
import { unavailableLane } from '@/lib/source-health/unavailableLane';

describe('SourceHealth truth table — 4 sources × 5 states', () => {
  for (const sourceId of ALL_SOURCE_IDS) {
    for (const state of ALL_SOURCE_HEALTH_STATES) {
      it(`(${sourceId}, ${state}) honors evidence-upgrade and unavailable-lane invariants`, () => {
        // canEvidenceBeUpgraded is true ONLY for LIVE
        if (state === 'LIVE') {
          expect(canEvidenceBeUpgraded(state)).toBe(true);
          expect(isHealthy(state)).toBe(true);
        } else {
          expect(canEvidenceBeUpgraded(state)).toBe(false);
          expect(isHealthy(state)).toBe(false);

          const lane = unavailableLane({
            sourceId: sourceId as SourceId,
            state: state as Exclude<SourceHealthState, 'LIVE'>,
            reason: 'truth_table_test',
            lastSeenAt: '2024-01-01T00:00:00.000Z',
          });

          expect(lane.sourceId).toBe(sourceId);
          expect(lane.state).toBe(state);
          expect(lane.lastSeenAt).toBe('2024-01-01T00:00:00.000Z');
          expect(typeof lane.userFacingMessage).toBe('string');
          expect(lane.userFacingMessage.length).toBeGreaterThan(0);

          // Sane retry policy
          expect(lane.retryPolicy.suggestedRetryAfterMs).toBeGreaterThan(0);
          expect(lane.retryPolicy.suggestedRetryAfterMs).toBeLessThanOrEqual(
            10 * 60_000,
          );
          expect(typeof lane.retryPolicy.canRetryNow).toBe('boolean');

          // RATE_LIMITED must back off (canRetryNow=false)
          if (state === 'RATE_LIMITED') {
            expect(lane.retryPolicy.canRetryNow).toBe(false);
          }
        }
      });
    }
  }
});
