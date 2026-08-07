import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as React from 'react';
import { SourceCoverageDiagram } from '../components/trust/SourceCoverageDiagram';
import { SOURCE_LANE_OPS } from '../lib/trust/sourceLanes';

describe('SourceCoverageDiagram is bound to the lane registry', () => {
  const html = renderToStaticMarkup(<SourceCoverageDiagram />);

  it('draws exactly one row per registered lane', () => {
    for (const lane of SOURCE_LANE_OPS) {
      expect(html).toContain(lane.marketingShortName);
    }
    // bar count == lane count (each lane draws a track + a fill)
    const tracks = (html.match(/<rect/g) ?? []).length;
    expect(tracks).toBe(SOURCE_LANE_OPS.length * 2);
  });

  it('states the live count from the registry, not a literal', () => {
    const live = SOURCE_LANE_OPS.filter(l => l.lifecycle === 'active').length;
    expect(html).toContain(`${live} of ${SOURCE_LANE_OPS.length} return data today`);
  });

  it('carries state as a word, not colour alone (WCAG 1.4.1)', () => {
    expect(html).toMatch(/Available|Access required|Not connected/);
  });

  it('scopes the claim to the lane, never a clinician', () => {
    expect(html).toContain('not a clinician result');
  });
});
