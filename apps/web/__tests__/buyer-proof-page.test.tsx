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
    expect(markup).toContain('Mock/dev containers are not production credentials');
    expect(markup).toContain('production-provider scaffold');
    expect(formSource).toContain("fetch('/api/pilot-request'");
    expect(markup).not.toContain('final credentialing decision');
    expectNoBuyerBannedStrings(markup);
  });

  it('keeps /employers live, limitation-aware, and routed to the review request entry', async () => {
    const { default: EmployersPage } = await import('../app/employers/page');

    const markup = renderToStaticMarkup(await EmployersPage());

    expect(markup).toContain('Claim your organization');
    // The claim entry itself, asserted by the field rather than by a heading
    // string. The heading moved when the page stopped opening with setup, and
    // the old assertion failed while the form was still perfectly present —
    // it was pinning the wording, not the capability it meant to protect.
    expect(markup).toContain('org-npi-input');
    expect(markup).toContain('Organization NPI (Type 2)');
    expect(markup).toContain('it is not legal proof of authority');
    expect(findHrefByText(markup, 'Request a pilot')).toBe('/pilot');
    expect(findHrefByText(markup, 'Open your workspace')).toBe('/employer/dashboard');
    expectNoBuyerBannedStrings(markup);
  });

  it('leads with the buyer outcome, not with setup mechanics', async () => {
    const { default: EmployersPage } = await import('../app/employers/page');
    const markup = renderToStaticMarkup(await EmployersPage());

    // The H1 is the promise, not the prerequisite. "Claim your organization"
    // may appear on the page — it is a real step — but it may not be the first
    // thing a buyer is asked to care about.
    const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(markup)?.[1] ?? '';
    expect(h1).toMatch(/start clinicians/i);
    expect(h1).not.toMatch(/claim your organization/i);

    // The boundary that must never drift: this page once promised "verify
    // clinicians" while `/` promised the opposite. VitalCV assembles evidence;
    // the institution decides. A public page may not claim otherwise.
    expect(markup).not.toMatch(/verify clinicians/i);
    expect(markup).toMatch(/does not credential, privilege, or clear anyone/i);

    // The artifact shares the first screen with the argument.
    expect(markup).toContain('data-employer-packet');
    // …and it is unfilled, because a populated one would be a fabricated
    // clinician.
    expect(markup).toMatch(/Nothing is filled in until a clinician shares/i);
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
