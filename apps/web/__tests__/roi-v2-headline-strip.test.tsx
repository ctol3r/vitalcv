import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RoiHeadlineStrip } from '../components/roi-v2';
import { HoursOnlyBanner } from '../components/roi-v2/HoursOnlyBanner';
import { getRoiV2DemoSnapshot, withHoursOnlyMode } from '../lib/roi-v2/fixtures';

const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

describe('RoiHeadlineStrip wage gating', () => {
  it('renders the dollar card when defaultWageUsd is set', () => {
    const snap = getRoiV2DemoSnapshot();
    const html = renderToStaticMarkup(
      <RoiHeadlineStrip
        pilot={snap.pilot}
        decisions={snap.decisions}
        hours={snap.hours}
        ttfd={snap.ttfd}
      />,
    );
    expect(html).toContain('At your default wage');
    expect(html).toMatch(/\$\d+(\.\d+)?K/);
    expect(html).toContain('based on your default wage');
  });

  it('renders the hours-only CTA when defaultWageUsd is null', () => {
    const snap = withHoursOnlyMode(getRoiV2DemoSnapshot());
    const html = renderToStaticMarkup(
      <RoiHeadlineStrip
        pilot={snap.pilot}
        decisions={snap.decisions}
        hours={snap.hours}
        ttfd={snap.ttfd}
      />,
    );
    expect(html).toContain('Dollar equivalents');
    expect(html).toContain('Activation Step');
    // No dollar values rendered when wage is null.
    expect(html).not.toMatch(/\$\d+(\.\d+)?K/);
  });

  it('always renders a qualifier on every metric card', () => {
    const snap = getRoiV2DemoSnapshot();
    const html = renderToStaticMarkup(
      <RoiHeadlineStrip
        pilot={snap.pilot}
        decisions={snap.decisions}
        hours={snap.hours}
        ttfd={snap.ttfd}
      />,
    );
    // Decisions card → "Observed · receipt-derived count for this pilot window"
    expect(html).toContain('Observed');
    // Hours card → "Projected · subject to volume"
    expect(html).toContain('Projected');
    // Dollars card → "Estimated · based on your default wage"
    expect(html).toContain('Estimated');
    // TTFD card → "Comparison vs. your baseline · not an industry average"
    expect(html).toContain('not an industry average');
  });

  it('describes the speedup in terms of the entered baseline', () => {
    const snap = getRoiV2DemoSnapshot();
    const html = renderToStaticMarkup(
      <RoiHeadlineStrip
        pilot={snap.pilot}
        decisions={snap.decisions}
        hours={snap.hours}
        ttfd={snap.ttfd}
      />,
    );
    expect(html).toMatch(/faster vs\. your baseline of \d+d/);
  });

  it('contains zero banned strings in either render path', () => {
    const both = [getRoiV2DemoSnapshot(), withHoursOnlyMode(getRoiV2DemoSnapshot())];
    for (const snap of both) {
      const html = renderToStaticMarkup(
        <RoiHeadlineStrip
          pilot={snap.pilot}
          decisions={snap.decisions}
          hours={snap.hours}
          ttfd={snap.ttfd}
        />,
      ).toLowerCase();
      for (const banned of BANNED) {
        expect(html).not.toContain(banned.toLowerCase());
      }
    }
  });
});

describe('HoursOnlyBanner', () => {
  it('renders when defaultWageUsd is null', () => {
    const snap = withHoursOnlyMode(getRoiV2DemoSnapshot());
    const html = renderToStaticMarkup(<HoursOnlyBanner pilot={snap.pilot} />);
    expect(html).toContain('Hours-only mode');
  });

  it('renders nothing when defaultWageUsd is set', () => {
    const snap = getRoiV2DemoSnapshot();
    const html = renderToStaticMarkup(<HoursOnlyBanner pilot={snap.pilot} />);
    expect(html).toBe('');
  });

  it('renders the Add wage button when onAddWage is provided', () => {
    const snap = withHoursOnlyMode(getRoiV2DemoSnapshot());
    const html = renderToStaticMarkup(
      <HoursOnlyBanner pilot={snap.pilot} onAddWage={() => {}} />,
    );
    expect(html).toContain('Add wage in Activation');
  });

  it('omits the Add wage button when onAddWage is missing', () => {
    const snap = withHoursOnlyMode(getRoiV2DemoSnapshot());
    const html = renderToStaticMarkup(<HoursOnlyBanner pilot={snap.pilot} />);
    expect(html).not.toContain('Add wage in Activation');
  });
});
