import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import ActivationCasePage from '../app/activation/[caseId]/page';

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

async function renderPage(caseId = 'demo-001'): Promise<string> {
  const element = await ActivationCasePage({ params: Promise.resolve({ caseId }) });
  return renderToStaticMarkup(element as React.ReactElement);
}

describe('activation case page — render', () => {
  it('renders the demo banner and case header', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-demo-banner"');
    expect(html).toContain('data-is-demo="true"');
    expect(html).toContain('data-case-id="VCV-START-DEMO-000841"');
    expect(html).toContain('data-completion-pct="25"');
  });

  it('renders all 4 critical-path stages in canonical order', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-critical-path"');
    for (const id of ['accepted', 'privileged', 'enrolled', 'cleared']) {
      expect(html).toContain(`data-stage-id="${id}"`);
    }
    expect(html).toContain('data-stage-state="done"');
    expect(html).toContain('data-stage-state="in_progress"');
    expect(html).toContain('data-stage-state="pending"');
  });

  it('renders the burn-down card with P10/P50/P90 values + 7-day trend', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-burndown"');
    expect(html).toContain('data-dts-p10="17"');
    expect(html).toContain('data-dts-p50="21"');
    expect(html).toContain('data-dts-p90="28"');
    const trendBars = html.match(/data-trend-day="\d+"/g) ?? [];
    expect(trendBars.length).toBe(7);
  });

  it('renders the counts strip with derived totals', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-counts-strip"');
    expect(html).toContain('data-testid="count-privileges"');
    expect(html).toContain('data-testid="count-payers"');
    expect(html).toContain('data-testid="count-onboarding"');
  });

  it('renders all 5 privileges with status badges', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-privileges"');
    for (const id of ['priv-cv1', 'priv-rsi', 'priv-firstassist', 'priv-prescribing', 'priv-sedation']) {
      expect(html).toContain(`data-priv-id="${id}"`);
    }
    expect(html).toContain('data-priv-status="granted"');
    expect(html).toContain('data-priv-status="proctoring"');
    expect(html).toContain('data-priv-status="training"');
  });

  it('renders the payer matrix with all 8 payers and the actionable flag', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-payer-table"');
    const rows = html.match(/data-payer-id="[^"]+"/g) ?? [];
    expect(rows.length).toBe(8);
    expect(html).toContain('data-actionable="true"');
  });

  it('renders all 10 onboarding tasks', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-onboarding"');
    const tasks = html.match(/data-task-id="[^"]+"/g) ?? [];
    expect(tasks.length).toBe(10);
    expect(html).toContain('data-task-state="done"');
    expect(html).toContain('data-task-state="in_progress"');
    expect(html).toContain('data-task-state="pending"');
  });

  it('renders 3 handoffs with exactly one marked current', async () => {
    const html = await renderPage();
    expect(html).toContain('data-testid="activation-handoffs"');
    const handoffs = html.match(/data-handoff-current="(true|false)"/g) ?? [];
    expect(handoffs.length).toBe(3);
    const current = handoffs.filter((h) => h.includes('"true"'));
    expect(current.length).toBe(1);
  });

  it('does not render bare "Verified" status labels anywhere', async () => {
    const html = await renderPage();
    expect(html).not.toMatch(/>\s*Verified\s*</);
  });

  it('introduces no banned overclaim copy', async () => {
    const html = await renderPage();
    const lower = html.toLowerCase();
    for (const phrase of BANNED) {
      expect(lower).not.toContain(phrase.toLowerCase());
    }
  });
});
