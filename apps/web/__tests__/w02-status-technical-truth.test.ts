/**
 * W0.2 — /status/technical tells the same truth as /api/status, and says which
 * build it is describing.
 *
 * The 2026-07-26 audit reported "public status pages contradict production
 * truth ... including OIG/PECOS as partial or planned". Checking only /status
 * made that look stale — /status had already been fixed to derive from the
 * registry. It was live on /status/technical, whose SourceLaneTelemetry
 * carried a SECOND hand-written LANE_LIFECYCLE literal publishing OIG
 * Exclusions and PECOS Enrollment as `planned` / PENDING INTEGRATION while the
 * registry, /api/status and /status all had them operational — plus a seventh
 * `dea_registration` lane that existed in no registry at all. #917 made that
 * unrepresentable in source by deriving the table from SOURCE_LANE_OPS.
 *
 * These pin the properties that let the deployed artifact be checked too:
 * every lane the registry publishes is renderable and joinable to /api/status,
 * and the vocabulary the technical page emits is one the prober understands.
 */

import { describe, expect, it } from 'vitest';

import { LANE_LIFECYCLE } from '@/components/ops/SourceLaneTelemetry';
import { SOURCE_LANE_OPS } from '@/lib/trust/sourceLanes';
import {
  compareLaneParity,
  // @ts-expect-error — plain .mjs script module, no type declarations
} from '../../../scripts/lib/lane-parity.mjs';

describe('W0.2 — the technical lane table derives from the registry', () => {
  it('publishes exactly the registry lanes, no more', () => {
    expect(LANE_LIFECYCLE.map((l) => l.laneId).sort()).toEqual(
      SOURCE_LANE_OPS.map((l) => l.statusApiKey).sort(),
    );
  });

  it('invents no lane the registry does not define', () => {
    // `dea_registration` was rendered to the public with no registry entry.
    const registryKeys = new Set(SOURCE_LANE_OPS.map((l) => l.statusApiKey));
    for (const lane of LANE_LIFECYCLE) {
      expect(registryKeys.has(lane.laneId)).toBe(true);
    }
  });

  it('carries the registry lifecycle and status verbatim for every lane', () => {
    for (const lane of SOURCE_LANE_OPS) {
      const rendered = LANE_LIFECYCLE.find((l) => l.laneId === lane.statusApiKey);
      expect(rendered).toBeDefined();
      expect(rendered?.lifecycle).toBe(lane.lifecycle);
      expect(rendered?.status).toBe(lane.statusApiStatus);
    }
  });

  it('reports OIG and PECOS as operational — the two rows that were wrong', () => {
    for (const key of ['oig_exclusions', 'pecos_enrollment']) {
      const row = LANE_LIFECYCLE.find((l) => l.laneId === key);
      expect(row?.status).toBe('operational');
      expect(row?.lifecycle).toBe('active');
    }
  });
});

describe('W0.2 — the technical table is joinable by the deploy prober', () => {
  /** What /api/status serves, built from the same registry. */
  const apiLanes = Object.fromEntries(
    SOURCE_LANE_OPS.map((l) => [l.statusApiKey, l.statusApiStatus]),
  );

  /** What the technical page's rows emit as data-lane-* attributes. */
  const renderedLanes = Object.fromEntries(
    LANE_LIFECYCLE.map((l) => [l.laneId, l.lifecycle]),
  );

  it('passes parity against /api/status', () => {
    const result = compareLaneParity(renderedLanes, apiLanes);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.checked).toBe(SOURCE_LANE_OPS.length);
  });

  it('emits only lifecycles the prober understands', () => {
    // The technical page renders SOURCE_LANE_OPS.lifecycle verbatim, so it can
    // emit `demo_only` where /status (via register.ts) folds that into
    // `unintegrated`. A lifecycle the prober does not know fails closed, so an
    // unhandled value would redden every deploy.
    const result = compareLaneParity(renderedLanes, apiLanes);
    expect(result.problems.join(' ')).not.toMatch(/unknown/);
  });

  it('would have failed on the pre-#917 table', () => {
    // The exact drift, reconstructed: OIG and PECOS rendered as planned.
    const drifted = {
      ...renderedLanes,
      oig_exclusions: 'planned',
      pecos_enrollment: 'planned',
    };
    const result = compareLaneParity(drifted, apiLanes);
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/oig_exclusions/);
    expect(result.problems.join(' ')).toMatch(/pecos_enrollment/);
  });

  it('would have failed on the phantom dea_registration lane', () => {
    const withPhantom = { ...renderedLanes, dea_registration: 'unintegrated' };
    const result = compareLaneParity(withPhantom, apiLanes);
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/dea_registration.*absent from/);
  });

  it('names the failing surface, so a red release points at the right page', () => {
    // Both /status and /status/technical render lanes. A diagnostic that always
    // said "/status" sent whoever is unblocking the release to the wrong file.
    const result = compareLaneParity({}, apiLanes, '/status/technical');
    expect(result.ok).toBe(false);
    expect(result.problems.join(' ')).toMatch(/\/status\/technical rendered no data-lane-key/);
    expect(result.problems.join(' ')).not.toMatch(/(?<!\/status)\/status rendered no/);
  });
});
