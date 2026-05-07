import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import AutopilotPage from '../app/autopilot/page';

const BANNED = [
  ['automatically', 'verified'].join(' '),
  ['guaranteed', 'verification'].join(' '),
  ['complete', 'credentialing'].join(' '),
  ['instant', 'credentialing'].join(' '),
  ['legally', 'accepted'].join(' '),
  ['risk', 'transferred'].join(' '),
  ['final', 'verification', 'without', 'review'].join(' '),
  ['source', 'confirmed', 'before', 'response'].join(' '),
  ['certified', 'compliant'].join(' '),
  ['HIPAA', 'compliant'].join(' '),
  ['SOC2', 'certified'].join(' '),
];

function renderAutopilot(): string {
  const element = AutopilotPage();
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('autopilot page — render', () => {
  it('renders the demo banner + trust tier label', () => {
    const html = renderAutopilot();
    expect(html).toContain('data-testid="autopilot-demo-banner"');
    expect(html).toContain('data-is-demo="true"');
    expect(html).toContain('data-trust-level="T3"');
    expect(html).toContain('data-testid="trust-tier-label"');
  });

  it('renders the trust score panel with composite + 6 factors', () => {
    const html = renderAutopilot();
    expect(html).toContain('data-testid="autopilot-trust-panel"');
    expect(html).toContain('data-testid="trust-score-composite"');
    expect(html).toContain('data-testid="trust-score-headline"');
    const factors = html.match(/data-testid="trust-factor"/g) ?? [];
    expect(factors.length).toBe(6);
  });

  it('renders the renewal radar with all 9 entries sorted by daysToExpire ascending', () => {
    const html = renderAutopilot();
    expect(html).toContain('data-testid="autopilot-renewal-radar"');
    const ids = [...html.matchAll(/data-renewal-id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBe(9);
    // First entry must be the most-urgent (smallest daysToExpire).
    const days = [...html.matchAll(/data-days-to-expire="(-?\d+)"/g)].map((m) => Number(m[1]));
    for (let i = 1; i < days.length; i++) {
      expect(days[i]).toBeGreaterThanOrEqual(days[i - 1]);
    }
  });

  it('renders the NBA queue with 3 ranked items', () => {
    const html = renderAutopilot();
    expect(html).toContain('data-testid="autopilot-nba-queue"');
    const items = html.match(/data-testid="nba-cta-primary"/g) ?? [];
    expect(items.length).toBe(3);
    expect(html).toContain('data-nba-rank="1"');
    expect(html).toContain('data-nba-rank="2"');
    expect(html).toContain('data-nba-rank="3"');
    // CTAs must be disabled in Phase 1.
    expect(html).toContain('data-disabled-reason="phase-2-pending"');
  });

  it('renders the portability map with 6 states', () => {
    const html = renderAutopilot();
    expect(html).toContain('data-testid="autopilot-portability-map"');
    const states = html.match(/data-state-code="[^"]+"/g) ?? [];
    expect(states.length).toBe(6);
    expect(html).toContain('data-primary="true"');
  });

  it('renders the drift monitor with 7 fields and all 4 statuses', () => {
    const html = renderAutopilot();
    expect(html).toContain('data-testid="autopilot-drift-monitor"');
    const fields = html.match(/data-drift-field="[^"]+"/g) ?? [];
    expect(fields.length).toBe(7);
    for (const status of ['fresh', 'aging', 'stale', 'divergent']) {
      expect(html).toContain(`data-drift-status="${status}"`);
    }
  });

  it('does not render the bare "Verified" status label anywhere', () => {
    const html = renderAutopilot();
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('introduces no banned overclaim copy', () => {
    const html = renderAutopilot();
    const lower = html.toLowerCase();
    for (const phrase of BANNED) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});
