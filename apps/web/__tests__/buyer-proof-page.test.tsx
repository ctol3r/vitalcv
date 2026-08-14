import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  findHrefByText,
  PROHIBITED_EMPLOYER_PUBLIC_STRINGS,
  PROHIBITED_PUBLIC_STRINGS,
} from './helpers/public-copy-guard';

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
  // Until 2026-08-07 the two shared lists below were exported and consumed by
  // NOTHING — orphaned guards (the failure mode session memory warns about:
  // a guard nobody runs enforces nothing). They are now enforced here, on the
  // buyer surfaces they were written for. 'no account needed/required' lives
  // in the EMPLOYER list by founder ruling: true and welcome on clinician
  // surfaces since #1090, wrong register where organization access is
  // requested.
  for (const banned of [
    ...BUYER_BANNED_STRINGS,
    ...PROHIBITED_PUBLIC_STRINGS,
    ...PROHIBITED_EMPLOYER_PUBLIC_STRINGS,
  ]) {
    expect(normalized, `buyer surface carries banned string: "${banned}"`).not.toContain(
      banned.toLowerCase(),
    );
  }
}

describe('Wave 5 buyer proof surface', () => {
  it('keeps /pilot honest about targets, limitations, source states, and CTA submission', async () => {
    const { default: PilotPage } = await import('../app/pilot/page');

    const markup = renderToStaticMarkup(<PilotPage />);

    const formSource = readFileSync(resolve(process.cwd(), 'app/pilot/PilotRequestForm.tsx'), 'utf8');

    expect(markup).toContain('Pilot target—not a published result');
    expect(markup).toContain('data-scene="activation_path"');
    expect(markup).toContain('data-activation-path="pilot"');
    expect(markup).toContain('NPPES confirms a public registry record only');
    expect(markup).toContain('Licensure remains access-gated');
    expect(markup).toContain('Record what the employer did');
    expect(markup).toContain('accepting one exact packet as a head start');
    expect(markup).toContain('A partial proof stays partial');
    // The limitation, not the wording that used to carry it. These previously
    // pinned 'Mock/dev containers are not production credentials' and
    // 'production-provider scaffold' — implementation vocabulary the YC audit
    // flagged as unfit for a buyer page ("mock" reads to a credentialing lead
    // as "the evidence is fake"). Removing those words must not remove the
    // disclosure, so the disclosure itself is what is asserted now.
    expect(markup).toContain('does not issue production credentials');
    expect(markup).not.toMatch(/mock/i);
    expect(markup).not.toContain('Internal simulation');
    expect(markup).not.toMatch(/Pilot\s*#\s*1\s*recorded/i);
    expect(formSource).toContain("fetch('/api/pilot-request'");
    expect(markup).not.toContain('final credentialing decision');
    expectNoBuyerBannedStrings(markup);
  });

  it('keeps /employers live, limitation-aware, and routed to the review request entry', async () => {
    const { default: EmployersPage } = await import('../app/employers/page');

    const markup = renderToStaticMarkup(await EmployersPage());

    // WO-15 makes the exact submitted packet the visual and verbal subject.
    // Human review, clarification, and institution authority remain explicit;
    // the route still makes no unmeasured speed claim.
    expect(markup).toContain('Review the exact packet');
    expect(markup).toContain('where each fact came from');
    expect(markup).toContain('Ask for clarification');
    expect(markup).toContain('Keep institution authority');
    expect(markup).not.toContain('Start clinicians faster');
    // D3: limits are stated plainly and EARLY on employer surfaces, and the
    // cadence line derives from the source-lane registry.
    expect(markup).toContain('data-employer-limits');
    expect(markup).toContain('not a credentialing service');
    expect(markup).toContain('monthly snapshot');
    expect(markup).toContain('quarterly snapshot');
    // The Type 2 step is real and necessary — but it is Step 1 of the
    // workflow, never the page's thesis. Since the restructure the form
    // itself lives on /employers/request-access ("Find your organization,
    // then request access" moved there with it — organization-access-copy
    // guards that route's substance). The landing keeps the ask
    // request-shaped, keeps the NPPES boundary beside it, and routes to the
    // form; the hiring-experience thesis must precede the workflow mechanics.
    expect(markup).toContain('Request organization access');
    expect(markup).toContain('href="/employers/request-access"');
    expect(markup).toContain('not authority to act for it');
    const heroAt = markup.indexOf('Review the exact packet');
    const workflowAt = markup.indexOf('data-employer-workflow');
    expect(workflowAt, 'workflow section renders').toBeGreaterThan(-1);
    expect(
      heroAt,
      'the hiring-experience thesis must precede the workflow mechanics',
    ).toBeLessThan(workflowAt);
    expect(findHrefByText(markup, 'Request a pilot')).toBe('/pilot');
    expect(findHrefByText(markup, 'Open your workspace')).toBe('/employer/dashboard');
    expectNoBuyerBannedStrings(markup);
  });

  it('keeps the review landing CTA pointed at the live request route', async () => {
    const { default: ReviewLandingPage } = await import('../app/review/page');

    const markup = renderToStaticMarkup(<ReviewLandingPage />);

    expect(markup).toContain('Employer review');
    expect(findHrefByText(markup, 'Request pilot review')).toBe('/review/request');
    expect(findHrefByText(markup, 'Start with NPI lookup')).toBe('/onboarding');
    expectNoBuyerBannedStrings(markup);
  });
});
