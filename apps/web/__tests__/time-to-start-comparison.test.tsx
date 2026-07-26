import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimeToStartComparison } from '../components/home/TimeToStartComparison';

describe('time-to-start comparison (NUM-1.4)', () => {
  it('keeps the cited industry queue and replaces the unsupported bar with evidence coverage', () => {
    const markup = renderToStaticMarkup(<TimeToStartComparison />);

    // Industry benchmark stays, cited and animated (SSR carries final text).
    expect(markup).toContain('Interview-to-start velocity');
    expect(markup).toContain('The industry queue');
    expect(markup).toContain('90–120');
    expect(markup).toContain('days, interview → start');
    expect(markup).toContain('data-metric-source="industry-benchmark"');

    // The VitalCV row is EVIDENCE COVERAGE — a live system fact, not a timeline.
    expect(markup).toContain('Starting from a VitalCV head start');
    expect(markup).toContain('data-time-to-start-coverage');
    expect(markup).toContain('data-metric-source="live-system-fact"');
    const liveSegments = markup.split('data-coverage-segment="live"').length - 1;
    const gatedSegments = markup.split('data-coverage-segment="gated"').length - 1;
    expect(liveSegments, 'three source-backed dimensions').toBe(3);
    expect(gatedSegments, 'licensure stays explicitly access-gated').toBe(1);
    expect(markup).toContain('Access required');

    // The unsupported 34% duration bar is GONE and cannot read as a result.
    expect(markup).not.toContain('34%');
    expect(markup).not.toContain('source-backed proof already in hand');
    // No unproven VitalCV time-to-start SLA is asserted.
    expect(markup).not.toContain('~45-60 days');
    expect(markup).not.toContain('Save ~30-45 days');

    // Honesty rail: coverage framing + no-pilot-claim line + accessible image.
    expect(markup).toContain('not a timeline');
    expect(markup).toContain('No pilot time-to-start outcome is claimed');
    expect(markup).toContain('role="img"');
  });
});
