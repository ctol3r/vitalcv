import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUBLIC_WEDGE_ROUTE_TARGETS } from '@/lib/trust/public-wedge-parity';

vi.mock('@/lib/launch/marketplace', () => ({
  fetchLaunchEmployers: vi.fn(async () => ({
    employers: [],
    total: 0,
  })),
}));

function readWorkspaceFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), 'utf8');
}

describe('wedge contract surfaces', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('React', React);
  });

  it('keeps the homepage NPI-first with no wedge bypass', () => {
    const homepageSource = readWorkspaceFile('app/page.tsx');
    const homepageClientSource = readWorkspaceFile('app/HomePageClient.tsx');
    const heroSource = readWorkspaceFile('components/hero/LiveTrustConsole.tsx');

    expect(homepageSource).toContain('<HomePageClient />');
    expect(homepageClientSource).toContain('<HeroWithAuthPrompt />');
    expect(heroSource).toContain('Enter your NPI');
    expect(heroSource).toContain('Apply with VCV');
    expect(heroSource).toContain('Check clinician readiness across federal sources in under 60 seconds.');
    expect(heroSource).not.toContain('Browse jobs');
    expect(heroSource).not.toContain('Explore roles');
  });

  it('keeps the passport surface focused on decision clarity and next action', () => {
    const passportSource = readWorkspaceFile('app/passport/page.tsx');

    expect(passportSource).toContain('Check Your Readiness');
    expect(passportSource).toContain('View full passport');
    expect(passportSource).toContain('View as employer');
    expect(passportSource).toContain('<WhatsNextPanel state={state} />');
    expect(passportSource).not.toContain('Open dashboard');
    expect(passportSource).not.toContain('Browse employers');
  });

  it('routes the employer surface into a concrete action path', async () => {
    const { default: EmployersPage } = await import('../app/employers/page');
    const markup = renderToStaticMarkup(await EmployersPage());

    expect(markup).toContain('Start a clinician review');
    expect(markup).toContain('Request clinician review');
    expect(markup).toContain(PUBLIC_WEDGE_ROUTE_TARGETS.reviewRequestEntry);
    expect(markup).toContain('Start with NPI Lookup');
    expect(markup).toContain(PUBLIC_WEDGE_ROUTE_TARGETS.passportEntry);
    expect(markup).not.toContain('Open Review Console');
  });
});
