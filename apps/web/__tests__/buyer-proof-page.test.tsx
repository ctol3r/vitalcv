import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findHrefByText } from './helpers/public-copy-guard';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string | { pathname?: string };
    children: React.ReactNode;
  }) => (
    <a href={typeof href === 'string' ? href : href.pathname ?? '#'} {...props}>
      {children}
    </a>
  ),
}));

const BUYER_BANNED_STRINGS = [
  'blockchain',
  'ledger',
  'wallet',
  'zero-knowledge',
  'zero trust',
  'zero-trust',
  'hire instantly',
  'SOC 2',
  'NCQA',
  'NPDB',
  'ABMS',
  'CAQH',
  'immutable',
  'immutably',
  'Audit Chain',
  'Trust Protocol',
  'Dock',
  'Web5',
] as const;

function expectNoBuyerBannedStrings(markup: string) {
  const normalized = markup.toLowerCase();
  for (const banned of BUYER_BANNED_STRINGS) {
    expect(normalized).not.toContain(banned.toLowerCase());
  }
}

describe('Wave 5 buyer proof surface', () => {
  it('keeps /pilot honest about KPIs, limitations, trust containers, and CTA submission', async () => {
    const { default: PilotPage } = await import('../app/pilot/page');

    const markup = renderToStaticMarkup(<PilotPage />);

    const formSource = readFileSync(resolve(process.cwd(), 'app/pilot/PilotRequestForm.tsx'), 'utf8');

    expect(markup).toContain('Internal simulation');
    expect(markup).toContain('not a customer pilot result');
    expect(markup).toContain('Limitation honesty');
    expect(markup).toContain('does not replace Primary Source Verification');
    expect(markup).toContain('A partial proof stays partial');
    // The limitation, not the wording that used to carry it. These previously
    // pinned 'Mock/dev containers are not production credentials' and
    // 'production-provider scaffold' — implementation vocabulary the YC audit
    // flagged as unfit for a buyer page ("mock" reads to a credentialing lead
    // as "the evidence is fake"). Removing those words must not remove the
    // disclosure, so the disclosure itself is what is asserted now.
    expect(markup).toContain('does not issue production credentials');
    expect(markup).not.toMatch(/mock/i);
    expect(formSource).toContain("fetch('/api/pilot-request'");
    expect(markup).not.toContain('final credentialing decision');
    expectNoBuyerBannedStrings(markup);
  });

  it('keeps /employers live, limitation-aware, and routed to the review request entry', async () => {
    const { default: EmployersPage } = await import('../app/employers/page');

    const markup = renderToStaticMarkup(await EmployersPage());

    // Wave 6: the doorway leads with the buyer outcome, not setup mechanics.
    // The outcome is stated WITHOUT a speed claim — "faster" was retired by the
    // brand split (2026-07-26) until a pilot measures time-to-start.
    expect(markup).toContain('Start clinicians from');
    expect(markup).toContain('source-backed evidence');
    expect(markup).not.toContain('Start clinicians faster');
    // D3: limits are stated plainly and EARLY on employer surfaces, and the
    // cadence line derives from the source-lane registry.
    expect(markup).toContain('data-employer-limits');
    expect(markup).toContain('not a credentialing service');
    expect(markup).toContain('monthly snapshot');
    expect(markup).toContain('quarterly snapshot');
    // The Type 2 claim is real and necessary — but it is Step 1 of the
    // workflow, rendered AFTER the operating model, never the page's thesis.
    expect(markup).toContain('Claim your organization');
    expect(markup).toContain('Enter your organization’s NPI');
    expect(markup).toContain('it is not legal proof of authority');
    const workflowAt = markup.indexOf('data-employer-workflow');
    const claimAt = markup.indexOf('Enter your organization’s NPI');
    expect(workflowAt, 'workflow section renders').toBeGreaterThan(-1);
    expect(
      workflowAt,
      'the operating model must precede the claim step (outcome before mechanics)',
    ).toBeLessThan(claimAt);
    expect(findHrefByText(markup, 'Request a pilot')).toBe('/pilot');
    expect(findHrefByText(markup, 'Open your workspace')).toBe('/employer/dashboard');
    expectNoBuyerBannedStrings(markup);
  });

  it('keeps the review landing CTA pointed at the live request route', async () => {
    const { default: ReviewLandingPage } = await import('../app/review/page');

    const markup = renderToStaticMarkup(<ReviewLandingPage />);

    expect(markup).toContain('Employer review');
    expect(findHrefByText(markup, 'Request pilot review')).toBe('/review/request');
    expect(findHrefByText(markup, 'Start with NPI lookup')).toBe('/passport');
    expectNoBuyerBannedStrings(markup);
  });
});
