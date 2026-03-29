import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveEmployerDirectoryCountSummary } from '../lib/employers/directory-count-summary';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    href: string;
    children: React.ReactNode;
  }) => React.createElement('a', { href, ...props }, children),
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('employers page truth counts', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.stubGlobal('React', React);
    process.env.BACKEND_URL = 'http://backend.test';
  });

  it('uses the displayed employer count while preserving total directory context', () => {
    const summary = resolveEmployerDirectoryCountSummary({
      employers: [
        {
          id: 'org_1',
          slug: 'alpha-health',
          name: 'Alpha Health',
          facilityType: 'Hospital',
          tagline: 'Regional acute care system',
          specialties: ['ICU'],
          states: ['CA'],
          openRoles: 3,
          trustScore: 92,
          hiringStatus: 'HIRING_NOW',
          verified: true,
          trustIndicators: [],
        },
        {
          id: 'org_2',
          slug: 'beta-medical',
          name: 'Beta Medical',
          facilityType: 'Clinic',
          tagline: 'Outpatient specialty network',
          specialties: ['Cardiology'],
          states: ['WA'],
          openRoles: 2,
          trustScore: 88,
          hiringStatus: 'ACTIVELY_HIRING',
          verified: true,
          trustIndicators: [],
        },
      ],
      total: 5,
    });

    expect(summary.displayed).toBe(2);
    expect(summary.total).toBe(5);
    expect(summary.helperText).toBe('2 shown on this page · 5 total live directory employers.');
  });

  it('keeps the helper text simple when the page shows the full live set', () => {
    const summary = resolveEmployerDirectoryCountSummary({
      employers: [],
      total: 0,
    });

    expect(summary.displayed).toBe(0);
    expect(summary.total).toBe(0);
    expect(summary.helperText).toBe('Organizations currently visible in the public directory.');
  });

  it('renders honest employer copy and keeps buyer CTA destinations on the canonical entry paths', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        employers: [
          {
            id: 'org_1',
            slug: 'alpha-health',
            name: 'Alpha Health',
            facilityType: 'Hospital',
            tagline: 'Regional acute care system',
            specialties: ['ICU'],
            states: ['CA', 'OR'],
            openRoles: 3,
            trustScore: 92,
            hiringStatus: 'HIRING_NOW',
            verified: true,
            trustIndicators: [],
          },
        ],
        total: 4,
      }))
      .mockResolvedValueOnce(jsonResponse({ total: 9 }));
    vi.stubGlobal('fetch', fetchMock);

    const { default: EmployersPage } = await import('../app/employers/page');
    const markup = renderToStaticMarkup(await EmployersPage());

    expect(markup).toContain('See current employers, roles, and review entry points.');
    expect(markup).toContain('Counts reflect what is visible here so the directory does not imply broader coverage than the current feed can support.');
    expect(markup).toContain('Employer review opens from a real passport share.');
    expect(markup).toContain('href="/onboarding?returnTo=%2Fexplore"');
    expect(markup).toContain('href="/review"');
    expect(markup).toContain('href="/explore"');
    expect(markup).not.toMatch(/verified employers/i);
    expect(markup).not.toMatch(/instant/i);
    expect(markup).not.toMatch(/guarantee/i);
    expect(markup).not.toMatch(/100%/i);
    expect(markup).not.toMatch(/all employers/i);
    expect(markup).not.toMatch(/every employer/i);
  });
});
