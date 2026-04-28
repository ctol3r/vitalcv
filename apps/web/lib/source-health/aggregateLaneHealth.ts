import {
  isHealthy,
  type SourceHealthSnapshot,
} from './sourceHealthTypes';
import { unavailableLane, type UnavailableLane } from './unavailableLane';

export interface AggregatedLaneHealth {
  snapshots: SourceHealthSnapshot[];
  unavailableLanes: UnavailableLane[];
  allHealthy: boolean;
}

/**
 * Pure, deterministic aggregator. Preserves input snapshot order and emits
 * an UnavailableLane record for every non-LIVE snapshot.
 */
export function aggregateLaneHealth(
  snapshots: SourceHealthSnapshot[],
): AggregatedLaneHealth {
  const unavailableLanes: UnavailableLane[] = [];
  let allHealthy = snapshots.length > 0;

  for (const snap of snapshots) {
    if (!isHealthy(snap.state)) {
      allHealthy = false;
      unavailableLanes.push(
        unavailableLane({
          sourceId: snap.sourceId,
          // After isHealthy=false, state cannot be 'LIVE'. Cast is safe.
          state: snap.state as Exclude<
            SourceHealthSnapshot['state'],
            'LIVE'
          >,
          reason: snap.reason,
          lastSeenAt: snap.lastSuccessAt,
        }),
      );
    }
  }

  return {
    snapshots: snapshots.slice(),
    unavailableLanes,
    allHealthy,
  };
}
