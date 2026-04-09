// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider, useClinicianMobile } from '../components/mobile/ClinicianMobileProvider';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

vi.mock('next/navigation', () => ({
  usePathname: () => '/holder/home',
  useSearchParams: () => new URLSearchParams(),
}));

function buildSampleData(refreshedAt: string): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: {
      personProfile: {
        npi: '1234567890',
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'ICU',
        stateOfPractice: 'OR',
        completeness: 88,
      },
    },
    trustState: {
      npi: '1234567890',
      readinessLevel: 'L2',
      readinessScore: 88,
      readinessStatus: 'Mostly ready - minor gaps remain',
      trustBand: 'L2',
      trustScore: 88,
      gapSummary: ['DEA registration not verified'],
      computedAt: refreshedAt,
      cached: false,
    },
    applications: [],
    opportunities: [
      {
        id: 'opp_1',
        organizationId: 'org_1',
        organizationName: 'Providence',
        organizationSlug: 'providence',
        title: 'Travel ICU Nurse',
        specialty: 'ICU',
        hiringType: 'contract',
        state: 'OR',
        payRange: '$3,600/week',
        requirementLevel: 'L2',
        description: 'Live role',
        remote: false,
        status: 'ACTIVE',
        createdAt: refreshedAt,
        application: null,
        match: {
          opportunityId: 'opp_1',
          band: 'CLEAR',
          score: 95,
          blockers: [],
          fitReasons: ['ICU specialty'],
        },
      },
    ],
    missingForHigherMatches: [],
    refreshedAt,
    profileCompleteness: {
      score: 88,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: false,
      },
    },
    trustHistory: [],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'apply_now',
      title: 'Apply to your best live match',
      description: 'Travel ICU Nurse is ready now.',
      href: '/holder/opportunities?apply=opp_1',
      ctaLabel: 'Apply now',
    },
  };
}

function Probe() {
  const {
    data,
    selectedOpportunityId,
    previousVisitAt,
    resumePath,
    refresh,
  } = useClinicianMobile();

  return (
    <div>
      <div data-testid="refreshed-at">{data.refreshedAt}</div>
      <div data-testid="selected-opportunity">{selectedOpportunityId ?? 'none'}</div>
      <div data-testid="previous-visit">{previousVisitAt ?? 'none'}</div>
      <div data-testid="resume-path">{resumePath ?? 'none'}</div>
      <button type="button" data-testid="refresh" onClick={() => void refresh()}>
        Refresh
      </button>
    </div>
  );
}

async function renderProbe(initialData: ClinicianMobileData) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <ClinicianMobileProvider initialData={initialData}>
        <Probe />
      </ClinicianMobileProvider>,
    );
  });

  return {
    container,
    async unmount() {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('ClinicianMobileProvider continuity', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-08T12:00:00.000Z'));
    vi.stubGlobal('React', React);
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('hydrates fresher cached dashboard and persisted revisit state before the utility surfaces render', async () => {
    const initialData = buildSampleData('2026-04-08T09:00:00.000Z');
    const cachedData = buildSampleData('2026-04-08T11:45:00.000Z');

    window.localStorage.setItem('vitalcv.mobile.dashboard-cache', JSON.stringify(cachedData));
    window.localStorage.setItem('vitalcv.mobile.selected-opportunity', 'opp_1');
    window.localStorage.setItem('vitalcv.mobile.last-visit', '2026-04-08T11:30:00.000Z');
    window.localStorage.setItem('vitalcv.mobile.resume-path', '/holder/opportunities?apply=opp_1');

    const view = await renderProbe(initialData);

    expect(view.container.querySelector('[data-testid="refreshed-at"]')?.textContent).toBe('2026-04-08T11:45:00.000Z');
    expect(view.container.querySelector('[data-testid="selected-opportunity"]')?.textContent).toBe('opp_1');
    expect(view.container.querySelector('[data-testid="previous-visit"]')?.textContent).toBe('2026-04-08T11:30:00.000Z');
    expect(view.container.querySelector('[data-testid="resume-path"]')?.textContent).toBe('/holder/opportunities?apply=opp_1');

    await view.unmount();
  });

  it('keeps the fresher local dashboard when a refresh returns an older payload', async () => {
    const initialData = buildSampleData('2026-04-08T11:45:00.000Z');
    const olderPayload = buildSampleData('2026-04-08T10:15:00.000Z');

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => olderPayload,
    }));

    const view = await renderProbe(initialData);

    await act(async () => {
      view.container.querySelector<HTMLButtonElement>('[data-testid="refresh"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(view.container.querySelector('[data-testid="refreshed-at"]')?.textContent).toBe('2026-04-08T11:45:00.000Z');

    await view.unmount();
  });
});
