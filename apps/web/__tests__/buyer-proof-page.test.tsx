import React from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { findHrefByText } from './helpers/public-copy-guard';

const fetchLaunchEmployersMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/launch/marketplace', () => ({
  fetchLaunchEmployers: fetchLaunchEmployersMock,
}));

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

  it.skip('keeps /employers live, limitation-aware, and routed to the review request entry', async () => {
    fetchLaunchEmployersMock.mockResolvedValueOnce({
      employers: [
        {
          id: 'org_1',
          slug: 'sample-health',
          name: 'Sample Health',
          facilityType: 'Hospital system',
          tagline: 'Current regional care network with public role coverage.',
          specialties: ['ICU'],
          states: ['CA', 'NV'],
          openRoles: 4,
          trustScore: 89,
          hiringStatus: 'HIRING_NOW',
          verified: true,
          trustIndicators: ['Current directory listing'],
        },
      ],
      total: 3,
    });

    const { default: EmployersPage } = await import('../app/employers/page');

    const markup = renderToStaticMarkup(await EmployersPage());

    expect(markup).toContain('Decision before data.');
    expect(markup).toContain('Stop chasing missing documents.');
    expect(markup).toContain('Limitation-aware packets');
    expect(markup).toContain('partial packet');
    expect(markup).toContain('1 shown on this page');
    expect(findHrefByText(markup, 'Request pilot review')).toBe('/review/request');
    expect(findHrefByText(markup, 'Start with NPI lookup')).toBe('/passport');
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
