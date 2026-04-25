/**
 * Wave LIVE-102 — lane-fidelity tests.
 *
 * Two layers:
 *   1. lib/sources/lane-mapper unit tests — proves the five lane
 *      states never collapse into one tone or one label.
 *   2. components/sources/ReadinessLanePanel render tests — proves
 *      the UI preserves per-lane disclaimers, surfaces detail
 *      strings, renders the NPPES "identity only" copy, and
 *      explains a null runId on the fallback path.
 */

import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
  toLaneViewModel,
  toLaneViewModels,
  type LaneState,
  type LaneTone,
  type RawLane,
} from '../lib/sources/lane-mapper';
import { ReadinessLanePanel } from '../components/sources/ReadinessLanePanel';

function laneRaw(overrides: Partial<RawLane> = {}): RawLane {
  return {
    source: 'NPPES',
    state: 'pending',
    cadence: 'live',
    detail: 'placeholder',
    ...overrides,
  };
}

describe('lane-mapper — pending != unavailable != access_required', () => {
  const states: LaneState[] = [
    'source_backed',
    'pending',
    'unavailable',
    'access_required',
    'stale',
  ];

  it('emits a distinct tone for every state', () => {
    const tones = new Set<LaneTone>();
    for (const state of states) {
      const vm = toLaneViewModel(laneRaw({ state }));
      tones.add(vm.tone);
    }
    expect(tones.size).toBe(states.length);
  });

  it('emits a distinct label suffix for every state', () => {
    const labels = new Set<string>();
    for (const state of states) {
      const vm = toLaneViewModel(laneRaw({ state }));
      labels.add(vm.label);
    }
    expect(labels.size).toBe(states.length);
  });

  it('always carries the NPPES "identity only" disclaimer regardless of state', () => {
    for (const state of states) {
      const vm = toLaneViewModel(laneRaw({ source: 'NPPES', state }));
      expect(vm.disclaimer.toLowerCase()).toContain('identity only');
      expect(vm.disclaimer.toLowerCase()).toContain('does not confirm licensure');
    }
  });

  it('always carries OIG/LEIE not-real-time disclaimer', () => {
    for (const state of states) {
      const vm = toLaneViewModel(laneRaw({ source: 'OIG_LEIE', state, cadence: 'monthly' }));
      expect(vm.disclaimer.toLowerCase()).toContain('not a real-time oig feed');
    }
  });

  it('always carries PECOS not-real-time disclaimer', () => {
    for (const state of states) {
      const vm = toLaneViewModel(
        laneRaw({ source: 'PECOS_PUBLIC', state, cadence: 'quarterly' }),
      );
      expect(vm.disclaimer.toLowerCase()).toContain('not the real-time pecos portal');
    }
  });

  it('always frames state board as institutional access, not clinician defect', () => {
    for (const state of states) {
      const vm = toLaneViewModel(
        laneRaw({ source: 'STATE_BOARD', state, cadence: 'lane_dependent' }),
      );
      expect(vm.disclaimer.toLowerCase()).toContain('institutional');
      expect(vm.disclaimer.toLowerCase()).toContain('not a clinician defect');
    }
  });

  it('falls back to safe defaults when the raw state or cadence is unexpected', () => {
    const vm = toLaneViewModel({
      source: 'NPPES',
      state: 'WAT' as unknown as LaneState,
      cadence: 'magic' as unknown as RawLane['cadence'],
    });
    expect(vm.state).toBe('unavailable');
    expect(vm.cadence).toBe('lane_dependent');
  });

  it('preserves identity projection when present', () => {
    const vm = toLaneViewModel(
      laneRaw({
        source: 'NPPES',
        state: 'source_backed',
        identity: {
          displayName: 'Test Clinician',
          enumerationType: 'NPI-1',
          taxonomy: 'Internal Medicine (207R00000X)',
          enumerationDate: '2010-01-01',
          lastUpdated: '2026-04-01',
          nppesStatus: 'A',
          practiceState: 'CA',
        },
      }),
    );
    expect(vm.identity?.displayName).toBe('Test Clinician');
    expect(vm.tone).toBe('success');
  });
});

describe('ReadinessLanePanel render', () => {
  const fourLanes: RawLane[] = [
    {
      source: 'NPPES',
      state: 'source_backed',
      cadence: 'live',
      detail: 'NPPES public registry confirmed identity at fetch time.',
      identity: {
        displayName: 'Recovered Identity',
        enumerationType: 'NPI-1',
        taxonomy: 'Internal Medicine (207R00000X)',
        enumerationDate: '2010-01-01',
        lastUpdated: '2026-04-01',
        nppesStatus: 'A',
        practiceState: 'CA',
      },
      sourceUrl: 'https://npiregistry.cms.hhs.gov/api?version=2.1&number=1003000126',
      readAt: '2026-04-25T00:00:00.000Z',
    },
    {
      source: 'OIG_LEIE',
      state: 'unavailable',
      cadence: 'monthly',
      detail: 'Federal exclusion list refresh runs monthly; current snapshot was not reachable. Not a real-time OIG feed.',
    },
    {
      source: 'PECOS_PUBLIC',
      state: 'unavailable',
      cadence: 'quarterly',
      detail: 'Medicare FFS public enrollment is a quarterly release. Latest snapshot was not reachable; this is not the real-time PECOS portal.',
    },
    {
      source: 'STATE_BOARD',
      state: 'access_required',
      cadence: 'lane_dependent',
      detail: 'State board lane requires institutional access (Nursys / FSMB / state portal). Not a clinician defect.',
    },
  ];

  it('renders four distinct lanes with different state attributes', () => {
    const html = renderToStaticMarkup(<ReadinessLanePanel lanes={fourLanes} />);
    expect(html).toContain('data-testid="lane-row-NPPES"');
    expect(html).toContain('data-testid="lane-row-OIG_LEIE"');
    expect(html).toContain('data-testid="lane-row-PECOS_PUBLIC"');
    expect(html).toContain('data-testid="lane-row-STATE_BOARD"');
    expect(html).toContain('data-lane-state="source_backed"');
    expect(html).toContain('data-lane-state="unavailable"');
    expect(html).toContain('data-lane-state="access_required"');
  });

  it('does not flatten access_required and unavailable into the same tone', () => {
    const html = renderToStaticMarkup(<ReadinessLanePanel lanes={fourLanes} />);
    const stateBoardBlock =
      html.match(/data-testid="lane-row-STATE_BOARD"[\s\S]*?<\/li>/)?.[0] ?? '';
    const oigBlock = html.match(/data-testid="lane-row-OIG_LEIE"[\s\S]*?<\/li>/)?.[0] ?? '';
    expect(stateBoardBlock).toContain('data-lane-tone="gated"');
    expect(oigBlock).toContain('data-lane-tone="warning"');
    expect(stateBoardBlock).not.toContain('data-lane-tone="warning"');
  });

  it('surfaces every lane detail string and disclaimer', () => {
    const html = renderToStaticMarkup(<ReadinessLanePanel lanes={fourLanes} />);
    for (const lane of fourLanes) {
      expect(html).toContain(`data-testid="lane-detail-${lane.source}"`);
      expect(html).toContain(`data-testid="lane-disclaimer-${lane.source}"`);
      expect(html).toContain(`data-testid="lane-cadence-${lane.source}"`);
    }
    expect(html).toContain('NPPES confirms identity only');
    expect(html).toContain('Not a real-time OIG feed');
    expect(html).toContain('Not the real-time PECOS portal');
    expect(html).toContain('institutional access');
  });

  it('renders the NPPES identity projection when source-backed', () => {
    const html = renderToStaticMarkup(<ReadinessLanePanel lanes={fourLanes} />);
    expect(html).toContain('data-testid="lane-identity-projection"');
    expect(html).toContain('Recovered Identity');
    expect(html).toContain('Internal Medicine (207R00000X)');
    expect(html).toContain('CA');
  });

  it('renders the fallback banner and runId explainer when fallback is true and runId is null', () => {
    const html = renderToStaticMarkup(
      <ReadinessLanePanel
        lanes={fourLanes}
        fallback
        fallbackReason="upstream_5xx"
        fallbackMessage="The readiness pipeline is temporarily degraded."
        runId={null}
        runIdReason="No ingest run was created because the backend ingest start did not return a usable response."
      />,
    );
    expect(html).toContain('data-testid="readiness-fallback-banner"');
    expect(html).toContain('data-testid="readiness-run-id-explainer"');
    expect(html).toContain('upstream_5xx');
    expect(html).toContain('No ingest run was created');
    expect(html).toContain('data-fallback="true"');
    expect(html).toContain('data-run-id="null"');
  });

  it('omits the fallback banner when the response is not a fallback', () => {
    const html = renderToStaticMarkup(
      <ReadinessLanePanel lanes={fourLanes} fallback={false} runId="run-123" />,
    );
    expect(html).not.toContain('data-testid="readiness-fallback-banner"');
    expect(html).not.toContain('data-testid="readiness-run-id-explainer"');
    expect(html).toContain('data-run-id="run-123"');
  });

  it('never renders a "verified" or "license checked" string', () => {
    const html = renderToStaticMarkup(<ReadinessLanePanel lanes={fourLanes} />).toLowerCase();
    expect(html).not.toContain('nppes verified license');
    expect(html).not.toContain('license checked via nppes');
    expect(html).not.toContain('fully verified');
    expect(html).not.toContain('on-chain');
  });

  it('toLaneViewModels preserves order and length', () => {
    const vms = toLaneViewModels(fourLanes);
    expect(vms.map((v) => v.source)).toEqual(['NPPES', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD']);
  });
});
