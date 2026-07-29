// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let currentParams = new URLSearchParams();

vi.mock('next/navigation', () => ({
  useSearchParams: () => currentParams,
}));

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

import { PublicOpportunityBoard } from '@/components/explore/PublicOpportunityBoard';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const opportunity = {
  id: 'opportunity-1', organizationId: 'organization-1', organizationName: 'Northstar Medical Group', organizationSlug: 'northstar-medical-group',
  title: 'General Cardiologist', specialty: 'Cardiology', hiringType: 'perm', state: 'CA', payRange: '$300,000–$350,000 / year',
  requirementLevel: 'L3', description: 'Outpatient cardiology role with a listed start timeline.', remote: false, status: 'ACTIVE',
  createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-20T00:00:00.000Z', startTimeline: '4–6 weeks',
  credentialRequirements: [{ label: 'CA Medical License', level: 'L3', priority: 'required' as const }],
  freshness: { listingStatus: 'stale' as const, employerDataStatus: 'partial' as const, completenessScore: 71, isStale: true, isUncertain: true, lastUpdatedAt: '2026-07-20T00:00:00.000Z' },
  source: { kind: 'employer_profile' as const, label: 'Employer profile + public opportunity record', updatedAt: '2026-07-20T00:00:00.000Z' },
  transparency: { hiringState: 'hiring now', speedToStartEstimate: '4–6 weeks', sponsorshipSupport: 'Visa policy not stated', benefitsVisibility: 'Some support details listed', listingFreshness: 'Potentially stale listing', employerDataCompleteness: 'partial source coverage (71%)', evidence: [] },
};

let container: HTMLDivElement;
let root: Root;

async function renderBoard() {
  await act(async () => {
    root.render(<PublicOpportunityBoard />);
  });
  await act(async () => {
    await vi.runAllTimersAsync();
  });
}

describe('PublicOpportunityBoard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentParams = new URLSearchParams();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ opportunities: [opportunity], total: 1 }), { status: 200 })));
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows source freshness instead of treating a stale listing as current and links signed-out visitors to compare safely', async () => {
    await renderBoard();

    expect(container.textContent).toContain('General Cardiologist');
    expect(container.textContent).toContain('Potentially stale');
    expect(container.textContent).toContain('Compensation');
    const signIn = container.querySelector('a[href^="/sign-in?redirect_url="]');
    expect(signIn?.textContent).toContain('Sign in to compare and apply');
  });

  it('keeps role requirements behind an intentional disclosure affordance', async () => {
    await renderBoard();
    const details = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('View requirements'));
    expect(details).toBeTruthy();

    await act(async () => {
      details?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(container.textContent).toContain('CA Medical License');
    expect(container.textContent).toContain('What VitalCV knows');
  });

  it('forwards a URL keyword query to the public opportunity endpoint', async () => {
    currentParams = new URLSearchParams('q=cardio');
    await renderBoard();
    expect(fetch).toHaveBeenCalledWith(
      '/api/opportunities?q=cardio&limit=50',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });
});
