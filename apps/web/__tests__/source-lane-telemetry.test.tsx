// apps/web/__tests__/source-lane-telemetry.test.tsx
import { describe, it, expect } from 'vitest';

import { LANE_LIFECYCLE } from '../components/ops/SourceLaneTelemetry';
import { SOURCE_LANE_OPS, getLaneDisplayName } from '../lib/trust/sourceLanes';

/**
 * W0.1 — the lane table on /status/technical must be DERIVED from
 * SOURCE_LANE_OPS, never declared alongside it.
 *
 * It used to be declared, and it drifted: OIG Exclusions and PECOS Enrollment
 * were published as `planned / pending_integration` while /api/status served
 * both as `active / operational` from the registry. The same page contradicted
 * the API it links to. It also carried a `dea_registration` row that exists
 * nowhere else in the product.
 *
 * These assert the OUTCOME — the rendered rows equal the registry — so any
 * future refactor that keeps them equal still passes.
 */
describe('source lane telemetry is derived from the canonical registry', () => {
  it('publishes exactly the registry lanes, in registry order', () => {
    expect(LANE_LIFECYCLE.map((l) => l.laneId)).toEqual(
      SOURCE_LANE_OPS.map((l) => l.statusApiKey),
    );
  });

  it('publishes the registry lifecycle and status for every lane', () => {
    for (const lane of SOURCE_LANE_OPS) {
      const row = LANE_LIFECYCLE.find((l) => l.laneId === lane.statusApiKey);
      expect(row, `no row for ${lane.statusApiKey}`).toBeDefined();
      expect(row!.lifecycle).toBe(lane.lifecycle);
      expect(row!.status).toBe(lane.statusApiStatus);
      expect(row!.displayName).toBe(getLaneDisplayName(lane.laneId));
    }
  });

  it('invents no lane the registry does not have', () => {
    const known = new Set(SOURCE_LANE_OPS.map((l) => l.statusApiKey));
    const invented = LANE_LIFECYCLE.filter((l) => !known.has(l.laneId)).map((l) => l.laneId);
    expect(invented).toEqual([]);
  });

  it('does not resurrect the DEA row', () => {
    // DEA appears only in demo, sandbox and simulation fixtures. A public
    // technical-status page must not publish an operational state for it.
    expect(LANE_LIFECYCLE.some((l) => l.laneId.includes('dea'))).toBe(false);
    expect(LANE_LIFECYCLE.some((l) => l.displayName.includes('DEA'))).toBe(false);
  });

  describe('the specific drift that shipped', () => {
    // Pinned individually: these two rows are the ones that contradicted
    // /api/status, so they are worth naming rather than only covering by the
    // general equality assertion above.
    it.each([
      ['oig_exclusions', 'active', 'operational'],
      ['pecos_enrollment', 'active', 'operational'],
    ])('%s renders %s / %s, matching /api/status', (laneId, lifecycle, status) => {
      const row = LANE_LIFECYCLE.find((l) => l.laneId === laneId);
      expect(row).toBeDefined();
      expect(row!.lifecycle).toBe(lifecycle);
      expect(row!.status).toBe(status);
    });
  });
});
