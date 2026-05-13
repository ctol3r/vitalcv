import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import RoiDashboardPage from '../app/roi/page';

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

function renderRoi(): string {
  const element = RoiDashboardPage();
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('roi dashboard — render', () => {
  it('renders the demo banner', () => {
    const html = renderRoi();
    expect(html).toContain('data-testid="roi-demo-banner"');
    expect(html).toContain('Demo cohort');
    expect(html).toContain('data-is-demo="true"');
  });

  it('renders the 4-KPI strip with computed values', () => {
    const html = renderRoi();
    expect(html).toContain('data-testid="roi-kpi-strip"');
    expect(html).toContain('data-testid="kpi-dts"');
    expect(html).toContain('data-dts-current="21"');
    expect(html).toContain('data-testid="kpi-auto"');
    expect(html).toContain('data-auto-pct="82"');
    expect(html).toContain('data-testid="kpi-compliance"');
    expect(html).toContain('data-compliance-pct="100"');
    expect(html).toContain('data-testid="kpi-capture"');
    expect(html).toContain('$4.19M');
  });

  it('renders the DTS timeline table with all 7 periods', () => {
    const html = renderRoi();
    expect(html).toContain('data-testid="roi-dts-table"');
    expect(html).toContain('data-period="2024-Q3"');
    expect(html).toContain('data-period="2026-Q1"');
    // Spot-check current quarter values
    expect(html).toContain('21d');
  });

  it('renders the blocker funnel with all 5 stages', () => {
    const html = renderRoi();
    expect(html).toContain('data-testid="roi-funnel-section"');
    for (const id of ['detected', 'auto', 'clinician', 'reviewer', 'committee']) {
      expect(html).toContain(`data-stage-id="${id}"`);
    }
  });

  it('renders the compliance grid with status badges', () => {
    const html = renderRoi();
    expect(html).toContain('data-testid="roi-compliance-table"');
    expect(html).toContain('data-authority="NCQA"');
    expect(html).toContain('data-authority="TJC"');
    expect(html).toContain('data-authority="CMS"');
    expect(html).toContain('data-status="aligned"');
  });

  it('renders the financial-impact methodology + by-facility table', () => {
    const html = renderRoi();
    expect(html).toContain('data-testid="roi-financial-section"');
    expect(html).toContain('Methodology');
    expect(html).toContain('data-testid="roi-by-facility-table"');
    expect(html).toContain('Demo Surgical Pavilion');
  });

  it('introduces no banned overclaim copy', () => {
    const html = renderRoi();
    const lower = html.toLowerCase();
    for (const phrase of BANNED) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
    // No bare "Verified" status badge.
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });
});
