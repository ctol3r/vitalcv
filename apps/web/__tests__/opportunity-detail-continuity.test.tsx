import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { PublicOpportunityDetail } from '@/components/explore/PublicOpportunityDetail';
import OpportunityDetailSurface from '@/app/holder/opportunities/[id]/OpportunityDetailSurface';
import {
  buildSignedOpportunityExplanation,
  opportunityFromPayload,
  opportunityIsActionable,
} from '@/lib/explore/opportunity-display';
import type { OpportunitySummary } from '@/lib/launch/marketplace';

const clinicianMobileState = vi.hoisted(() => ({
  opportunities: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/components/mobile/ClinicianMobileProvider', () => ({
  useClinicianMobile: () => ({
    data: { opportunities: clinicianMobileState.opportunities },
  }),
}));

vi.mock('@/components/workbench/CaptureInWorkbench', () => ({
  CaptureInWorkbench: () => null,
}));

function opportunity(overrides: Partial<OpportunitySummary> = {}): OpportunitySummary {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    organizationId: 'org-1',
    organizationName: 'Example clinical organization',
    organizationSlug: 'example-clinical-organization',
    title: 'Part-Time Family Medicine Physician',
    specialty: 'Family Medicine',
    profession: 'physician',
    schedule: 'part_time',
    hiringType: 'locums',
    state: 'CA',
    payRange: null,
    requirementLevel: 'L1',
    description: 'Outpatient coverage in a community clinical setting.',
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-08-14T08:00:00.000Z',
    updatedAt: '2026-08-14T08:05:00.000Z',
    employerType: 'Outpatient clinic',
    source: {
      kind: 'public_feed',
      label: 'Listed on greenhouse',
      updatedAt: '2026-08-14T08:05:00.000Z',
      url: 'https://job-boards.greenhouse.io/example/jobs/123',
      fetchedAt: '2026-08-14T08:06:00.000Z',
    },
    isFeedListing: true,
    availability: {
      state: 'open',
      confidence: 'recent_observation',
      observedAt: '2026-08-14T08:06:00.000Z',
      limitation: 'The source was observed recently; the employer can still change or close the role.',
    },
    applicationMode: 'external',
    compensationProvenance: {
      state: 'not_supplied',
      method: 'not_supplied',
      sourceLabel: 'Listed on greenhouse',
      observedAt: '2026-08-14T08:06:00.000Z',
    },
    explanation: {
      whyThisMayFit: [],
      whatMayBlockYou: [],
      resolveNext: [],
      stillUnknown: ['Employer-stated requirements were not supplied.'],
    },
    ...overrides,
  };
}

describe('WO-14 opportunity detail continuity', () => {
  it('keeps an external source, observation, uncertainty, and external action together', () => {
    const html = renderToStaticMarkup(
      <PublicOpportunityDetail opportunity={opportunity()} />,
    );

    expect(html).toContain('data-application-mode="external"');
    expect(html).toContain('data-availability-state="open"');
    expect(html).toContain('Listed on greenhouse');
    expect(html).toContain('Observed Aug 14, 2026');
    expect(html).toContain('View original listing');
    expect(html).toContain('What the listing says');
    expect(html).not.toContain('Apply with VitalCV');
    expect(html).not.toMatch(/ready now|you are eligible|not eligible|readiness snapshot/i);
  });

  it('reserves Apply with VitalCV for an integrated role', () => {
    const integrated = opportunity({
      source: {
        kind: 'opportunity',
        label: 'Public opportunity record',
        updatedAt: '2026-08-14T08:05:00.000Z',
        url: '/opportunities/11111111-1111-1111-1111-111111111111',
        fetchedAt: null,
      },
      isFeedListing: false,
      applicationMode: 'vitalcv',
    });
    const html = renderToStaticMarkup(<PublicOpportunityDetail opportunity={integrated} />);

    expect(html).toContain('data-application-mode="vitalcv"');
    expect(html).toContain('Apply with VitalCV');
    expect(html).not.toContain('View original listing');
  });

  it('renders a closed direct link honestly without an application action', () => {
    const closed = opportunity({
      status: 'CLOSED',
      availability: {
        state: 'closed',
        confidence: 'recent_observation',
        observedAt: '2026-08-14T08:06:00.000Z',
        limitation: 'This role is recorded as closed.',
      },
    });
    const html = renderToStaticMarkup(<PublicOpportunityDetail opportunity={closed} />);

    expect(opportunityIsActionable(closed)).toBe(false);
    expect(html).toContain('This role is recorded as closed');
    expect(html).not.toContain('View original listing');
    expect(html).not.toContain('Apply with VitalCV');
  });

  it('combines MATCHA reasons, gaps, uncertainty, and next actions without a score', () => {
    const detail = buildSignedOpportunityExplanation(
      opportunity({
        explanation: {
          whyThisMayFit: ['Family Medicine aligns with this role.'],
          whatMayBlockYou: ['State license evidence needs review.'],
          resolveNext: ['Review the state license evidence.'],
          stillUnknown: ['Schedule details were not supplied.'],
        },
      }),
      {
        fitReasons: ['Family Medicine aligns with this role.', 'Location preference aligns.'],
        blockers: [{
          label: 'State license evidence needs review.',
          action: 'Review the state license evidence.',
        }],
      },
    );

    expect(detail).toEqual({
      whyThisMayFit: ['Family Medicine aligns with this role.', 'Location preference aligns.'],
      evidenceGaps: ['State license evidence needs review.'],
      resolveNext: ['Review the state license evidence.'],
      stillUnknown: ['Schedule details were not supplied.'],
    });
    expect(JSON.stringify(detail)).not.toMatch(/score|eligib|ready now/i);
  });

  it('renders the signed-in explanation and external-source action without an eligibility verdict', () => {
    clinicianMobileState.opportunities = [{
      ...opportunity({
        explanation: {
          whyThisMayFit: ['Family Medicine aligns with this role.'],
          whatMayBlockYou: ['State license evidence needs review.'],
          resolveNext: ['Review the state license evidence.'],
          stillUnknown: ['Schedule details were not supplied.'],
        },
      }),
      application: null,
      match: {
        opportunityId: '11111111-1111-1111-1111-111111111111',
        band: 'PARTIAL',
        score: 52,
        blockers: [],
        fitReasons: ['Location preference aligns.'],
      },
    }];

    const html = renderToStaticMarkup(
      <OpportunityDetailSurface opportunityId="11111111-1111-1111-1111-111111111111" />,
    );

    expect(html).toContain('Role fit · clinician-side explanation');
    expect(html).toContain('Family Medicine aligns with this role.');
    expect(html).toContain('State license evidence needs review.');
    expect(html).toContain('Schedule details were not supplied.');
    expect(html).toContain('View original listing');
    expect(html).not.toContain('Review evidence and apply');
    expect(html).not.toMatch(/52|ready now|you are eligible|not eligible/i);
  });

  it('keeps an integrated signed-in role on the existing disclosure composer path', () => {
    clinicianMobileState.opportunities = [{
      ...opportunity({
        source: {
          kind: 'opportunity',
          label: 'Public opportunity record',
          updatedAt: '2026-08-14T08:05:00.000Z',
          url: '/opportunities/11111111-1111-1111-1111-111111111111',
          fetchedAt: null,
        },
        isFeedListing: false,
        applicationMode: 'vitalcv',
      }),
      application: null,
      match: null,
    }];

    const html = renderToStaticMarkup(
      <OpportunityDetailSurface opportunityId="11111111-1111-1111-1111-111111111111" />,
    );

    expect(html).toContain('Review evidence and apply');
    expect(html).toContain('/holder/opportunities?apply=11111111-1111-1111-1111-111111111111');
    expect(html).toContain('Preview, choose, consent, then seal');
    expect(html).not.toContain('View original listing');
  });

  it('preserves the canonical truth record from the signed-in proxy payload', () => {
    const role = opportunity();
    expect(opportunityFromPayload({ opportunity: role })).toBe(role);
    expect(opportunityFromPayload({ opportunity: { title: role.title } })).toBeNull();
  });
});
