import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimeToStartComparison } from '../components/home/TimeToStartComparison';

describe('time-to-start comparison', () => {
  it('renders the Interview-to-Start Velocity bar with honest, illustrative framing', () => {
    const markup = renderToStaticMarkup(<TimeToStartComparison />);

    // Deck-derived ISV framing (Chris, 2026-07-17): industry queue vs the
    // source-backed head start VitalCV carries in.
    expect(markup).toContain('Interview-to-start velocity');
    expect(markup).toContain('The industry queue');
    expect(markup).toContain('90–120 days, interview → start');
    expect(markup).toContain('Starting from a VitalCV head start');
    expect(markup).toContain('source-backed proof already in hand');
    // No unproven VitalCV time-to-start SLA is asserted.
    expect(markup).not.toContain('~45-60 days');
    expect(markup).not.toContain('Save ~30-45 days');
    // Illustrative disclaimer + accessible comparison image role.
    expect(markup).toContain('not a guaranteed timeline');
    expect(markup).toContain('No pilot time-to-start outcome is claimed');
    expect(markup).toContain('role="img"');
  });
});
