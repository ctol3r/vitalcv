import { describe, expect, it } from '@jest/globals';
import {
  DEFAULT_STATE_GRAPH,
  getAuthorizedStates,
  getAuthorizedStatesDetailed,
} from '../compactGraph.js';

describe('CompactStateGraph', () => {
  it('excludes the home state for IMLC authorizations', () => {
    const states = getAuthorizedStates('IMLC', 'TX');
    expect(states.length).toBeGreaterThan(10);
    expect(states).not.toContain('TX');
  });

  it('includes the home state for PSYPACT', () => {
    const states = getAuthorizedStates('PSYPACT', 'AZ');
    expect(states).toContain('AZ');
    expect(states.length).toBeGreaterThan(5);
  });

  it('returns empty array when the home state is not active in the compact', () => {
    const states = getAuthorizedStates('IMLC', 'CA');
    expect(states).toEqual([]);
  });

  it('honors APRN residency + waiting period requirements', () => {
    const early = getAuthorizedStatesDetailed('APRN', 'TX', {
      residencyState: 'TX',
      rnLicenseActive: true,
      lastMoveDate: new Date('2025-02-10'),
      asOf: new Date('2025-02-20'),
    });
    expect(early.states).toHaveLength(0);
    expect(early.aprn?.needsWaitingPeriod).toBe(true);

    const cleared = getAuthorizedStatesDetailed('APRN', 'TX', {
      residencyState: 'TX',
      rnLicenseActive: true,
      lastMoveDate: new Date('2024-12-01'),
      asOf: new Date('2025-03-15'),
    });
    expect(cleared.states.length).toBeGreaterThan(0);
    expect(cleared.aprn?.needsWaitingPeriod).toBe(false);
  });

  it('can use a custom graph for what-if analyses', () => {
    const customGraph = {
      ...DEFAULT_STATE_GRAPH,
      IMLC: {
        ...DEFAULT_STATE_GRAPH.IMLC,
        TX: {
          ...DEFAULT_STATE_GRAPH.IMLC.TX,
          status: 'ORGANIZATIONAL_ONLY',
        },
      },
    };

    const states = getAuthorizedStates('IMLC', 'TX', { graph: customGraph });
    expect(states).toEqual([]);
  });
});
