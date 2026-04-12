// @vitest-environment jsdom

import * as React from 'react';
import { act } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import { OpportunityGrid } from '../components/mobile/ClinicianPanels';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';
import {
  buildCompactBadgeLabel,
  buildMobileSnapshotSummary,
  evaluateMobileApplyEligibility,
  summarizeMissingMobileItems,
} from '../lib/mobile/summaries';

const {
  routerReplaceMock,
} = vi.hoisted(() => ({
  routerReplaceMock: vi.fn(),
}));

vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);

let mockPathname = '/holder/opportunities';
let mockSearchParams = new URLSearchParams();

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return {
    ...actual,
    redirect: vi.fn(),
    usePathname: () => mockPathname,
    useSearchParams: () => mockSearchParams,
    useRouter: () => ({
      push: vi.fn(),
      replace: routerReplaceMock,
      prefetch: vi.fn(),
    }),
    notFound: () => {
      throw new Error('notFound');
    },
  };
});

vi.mock('../components/explore/ApplyModal', () => ({
  default: () => null,
}));

vi.mock('../lib/mobile/analytics', () => ({
  trackClinicianEvent: vi.fn(async () => undefined),
  trackClinicianEventOncePerSession: vi.fn(async () => undefined),
}));

function buildData(): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: {
      personProfile: {
        npi: '1234567890',
        firstName: 'Ada',
        lastName: 'Lovelace',
        specialty: 'ICU',
        stateOfPractice: 'OR',
        completeness: 92,
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
      computedAt: '2026-03-20T10:30:00.000Z',
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
        createdAt: '2026-03-18T10:00:00.000Z',
        application: null,
        match: {
          opportunityId: 'opp_1',
          band: 'NEAR_CLEAR',
          score: 91,
          blockers: [{ label: 'DEA registration not verified' }],
          fitReasons: ['ICU specialty', 'Oregon license'],
        },
      },
    ],
    missingForHigherMatches: ['DEA registration not verified'],
    refreshedAt: '2026-03-20T10:30:00.000Z',
    profileCompleteness: {
      score: 92,
      dimensions: {
        npiVerified: true,
        resumeUploaded: true,
        linksAdded: true,
        workAuthProvided: true,
        credentialsImported: true,
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
      description: 'Travel ICU Nurse is the shortest path from readiness into action.',
      href: '/holder/opportunities?apply=opp_1',
      ctaLabel: 'Apply now',
    },
  };
}

async function renderNode(node: React.ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(node);
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('mobile summary helpers', () => {
  beforeEach(() => {
    mockPathname = '/holder/opportunities';
    mockSearchParams = new URLSearchParams();
    routerReplaceMock.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reports blocked mobile apply states deterministically', () => {
    const eligibility = evaluateMobileApplyEligibility({
      matchBand: 'INELIGIBLE',
      blockers: ['State license not verified', 'DEA registration expired'],
    });

    expect(eligibility).toEqual({
      state: 'blocked',
      canApply: false,
      badgeLabel: 'Blocked',
      summary: 'Apply is blocked by State license not verified +1 more.',
      blockers: ['State license not verified', 'DEA registration expired'],
    });
  });

  it('renders compact badge labels for match and application states', () => {
    expect(buildCompactBadgeLabel({ kind: 'match', band: 'NEAR_CLEAR' })).toBe('Near clear');
    expect(buildCompactBadgeLabel({ kind: 'application', status: 'REVIEWED' })).toBe('In review');

    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildData()}>
        <OpportunityGrid opportunities={buildData().opportunities} />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('Near clear');
  });

  it('summarizes missing critical items without duplicating labels', () => {
    const summary = summarizeMissingMobileItems([
      'State license not verified',
      ' DEA registration expired ',
      'State license not verified',
    ]);

    expect(summary).toEqual({
      items: ['State license not verified', 'DEA registration expired'],
      count: 2,
      shortLabel: 'State license not verified +1 more',
      detail: 'State license not verified plus 1 more item',
    });
  });

  it('builds snapshot reuse messaging from the current mobile readiness state', () => {
    const summary = buildMobileSnapshotSummary({
      readiness: buildData().trustState,
      reused: true,
    });

    expect(summary.badgeLabel).toBe('Snapshot reused');
    expect(summary.summary).toBe('Using the latest verified mobile snapshot.');
    expect(summary.readiness.badgeLabel).toBe('L2');
    expect(summary.missingItems.shortLabel).toBe('DEA registration not verified');
  });

  it('clears stale apply route state when the target opportunity is gone', async () => {
    mockSearchParams = new URLSearchParams('apply=missing_opp');

    const view = await renderNode(
      <ClinicianMobileProvider initialData={buildData()}>
        <OpportunityGrid opportunities={buildData().opportunities} />
      </ClinicianMobileProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(routerReplaceMock).toHaveBeenCalledWith('/holder/opportunities', { scroll: false });

    await view.unmount();
  });
});
