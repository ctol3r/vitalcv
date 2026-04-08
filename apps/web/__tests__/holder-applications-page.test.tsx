import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ClinicianMobileProvider } from '../components/mobile/ClinicianMobileProvider';
import ClinicianApplicationsSurface from '../components/mobile/ClinicianApplicationsSurface';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

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

function buildSampleData(): ClinicianMobileData {
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
      readinessStatus: 'Mostly ready - one blocker left',
      trustBand: 'L2',
      trustScore: 88,
      gapSummary: ['DEA registration not verified'],
      computedAt: '2026-04-08T09:00:00.000Z',
      cached: false,
    },
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-04-08T09:00:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: {
      kind: 'apply_now',
      title: 'Explore matched roles',
      description: 'Your current record is ready for the next role.',
      href: '/holder/opportunities',
      ctaLabel: 'Explore matched roles',
    },
  };
}

describe('/holder/applications page', () => {
  it('avoids a dead end when the clinician has no live applications yet', () => {
    const markup = renderToStaticMarkup(
      <ClinicianMobileProvider initialData={buildSampleData()}>
        <ClinicianApplicationsSurface />
      </ClinicianMobileProvider>,
    );

    expect(markup).toContain('No live applications yet');
    expect(markup).toContain('reuse your current passport and readiness context automatically');
    expect(markup).toContain('Explore matched roles');
    expect(markup).toContain('/holder/opportunities');
  });
});
