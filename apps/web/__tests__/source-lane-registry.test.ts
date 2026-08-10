/**
 * NUM-1.5 — the source-lane registry is the only definition of lane truth.
 *
 * Lane truth previously lived in four hand-maintained places and drifted: the
 * public /status page said OIG was `partial` and never mentioned PECOS, while
 * /api/status published both as live. These tests pin the surfaces to the
 * registry so the two public answers cannot disagree again, and so the
 * homepage's counts stay bound to the lanes rather than to string literals.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { KNOWN_LANES } from '@/components/proof/trust-types';
import {
  SOURCE_LANE_OPS,
  getLiveSourceLanes,
  getReadinessDimensionLanes,
  toRegisterLifecycle,
} from '@/lib/trust/sourceLanes';

const repoFile = (rel: string) => readFileSync(path.join(__dirname, '..', rel), 'utf8');

describe('source-lane registry', () => {
  it('defines every lane that the proof surfaces know about', () => {
    expect(SOURCE_LANE_OPS.map((l) => l.laneId).sort()).toEqual(
      KNOWN_LANES.map((l) => l.laneId).sort(),
    );
  });

  it('counts three live lanes and four readiness dimensions', () => {
    // The figures the homepage renders as `03` and `04`. If a lane's lifecycle
    // legitimately changes, update this expectation deliberately — that is the
    // point of the test.
    expect(getLiveSourceLanes().map((l) => l.laneId)).toEqual([
      'nppes_identity',
      'oig_exclusions',
      'pecos_enrollment',
    ]);
    expect(getReadinessDimensionLanes().map((l) => l.readinessDimension)).toEqual([
      'identity',
      'exclusion',
      'licensure',
      'enrollment',
    ]);
  });

  it('never publishes a lane as live without saying what limits it', () => {
    for (const lane of getLiveSourceLanes()) {
      expect(lane.detail, `${lane.laneId} is live but carries no operating detail`).toBeTruthy();
    }
  });

  it('collapses demo_only to unintegrated for the register, never to active', () => {
    expect(toRegisterLifecycle('demo_only')).toBe('unintegrated');
    expect(toRegisterLifecycle('active')).toBe('active');
    // Nothing may reach the public register as a live lane unless it is live.
    const registerLive = SOURCE_LANE_OPS.filter(
      (l) => toRegisterLifecycle(l.lifecycle) === 'active',
    );
    expect(registerLive).toEqual(getLiveSourceLanes());
  });

  it('keeps board_cert publishing under its historical /api/status key', () => {
    const boardCert = SOURCE_LANE_OPS.find((l) => l.laneId === 'board_cert');
    // status-source-lanes.test.ts pins this spelling; renaming it breaks a
    // public payload.
    expect(boardCert?.statusApiKey).toBe('board_certification');
  });

  it('leaves no hand-written lane list behind in the surfaces it replaced', () => {
    // Guards the actual regression: a second copy of lane truth reappearing.
    const register = repoFile('lib/trust/register.ts');
    expect(register).toContain('SOURCE_LANE_OPS');
    expect(register).not.toMatch(/sourceId: 'oig_exclusions'/);

    const statusRoute = repoFile('app/api/status/route.ts');
    expect(statusRoute).toContain('SOURCE_LANE_OPS');
    expect(statusRoute).not.toMatch(/oig_exclusions: \{/);

    // components/home/MetricStrip.tsx was the fourth surface this block
    // pinned; the component was retired (unmounted, 2026-08-09) and deleted,
    // so there is no homepage copy left to check.

    // The ribbon keeps its own copy (names, accessible descriptions) but its
    // cadence badges must come from the registry, never a hardcoded label.
    const ribbon = repoFile('components/home/SourceCoverageRibbon.tsx');
    expect(ribbon).toContain('SOURCE_LANE_OPS');
    expect(ribbon).not.toMatch(/label: 'read live'/);
    expect(ribbon).not.toMatch(/label: 'monthly snapshot'/);
  });
});
