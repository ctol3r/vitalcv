import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BoardResultRow } from '@/components/explore/board/BoardResultRow';
import { OpportunityLensRail } from '@/components/explore/board/OpportunityLensRail';
import {
  clampedBoardPage,
  parseBoardFilters,
  serializeBoardFilters,
  toApiQuery,
} from '@/lib/explore/board-filters';
import type { OpportunitySummary } from '@/lib/launch/marketplace';

function externalRole(): OpportunitySummary {
  return {
    id: 'opp-external',
    organizationId: 'org-1',
    organizationName: 'Example clinical organization',
    organizationSlug: 'example-clinical-organization',
    title: 'Part-Time Family Medicine Physician',
    specialty: 'Family Medicine',
    profession: 'physician',
    schedule: 'part_time',
    hiringType: 'perm',
    state: 'CA',
    payRange: null,
    requirementLevel: 'L1',
    description: null,
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-08-14T08:00:00.000Z',
    updatedAt: '2026-08-14T08:05:00.000Z',
    payRangeMin: null,
    payRangeMax: null,
    payUnit: 'unknown',
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
  };
}

describe('WO-13 public opportunity field', () => {
  it('keeps source, observation, availability, and the external application boundary together', () => {
    const html = renderToStaticMarkup(
      <BoardResultRow opportunity={externalRole()} ordinal={1} />,
    );

    expect(html).toContain('data-application-mode="external"');
    expect(html).toContain('data-availability-state="open"');
    expect(html).toContain('Listed on greenhouse');
    expect(html).toContain('Observed Aug 14, 2026');
    expect(html).toContain('Recent source observation');
    expect(html).toContain('Not supplied by source');
    expect(html).toContain('View original listing');
    expect(html).toContain('/opportunities/opp-external');
    expect(html).toContain('https://job-boards.greenhouse.io/example/jobs/123');
    expect(html).not.toContain('Apply with VitalCV');
    expect(html).not.toMatch(/ready now|your readiness|eligib/i);
  });

  it('reserves Apply with VitalCV for an integrated opportunity record', () => {
    const role: OpportunitySummary = {
      ...externalRole(),
      id: 'opp-integrated',
      source: {
        kind: 'opportunity',
        label: 'Public opportunity record',
        updatedAt: '2026-08-14T08:05:00.000Z',
        url: '/opportunities/opp-integrated',
        fetchedAt: null,
      },
      isFeedListing: false,
      applicationMode: 'vitalcv',
    };
    const html = renderToStaticMarkup(<BoardResultRow opportunity={role} ordinal={2} />);
    expect(html).toContain('data-application-mode="vitalcv"');
    expect(html).toContain('Apply with VitalCV');
    expect(html).not.toContain('View original listing');
  });

  it('preserves a source title while adding a safe wrap point after a slash', () => {
    const role: OpportunitySummary = {
      ...externalRole(),
      title: 'Nurse Practitioner/Physician Assistant',
    };
    const html = renderToStaticMarkup(<BoardResultRow opportunity={role} ordinal={1} />);

    expect(html).toContain('Nurse Practitioner/<wbr/>Physician Assistant');
  });

  it('limits the public URL contract to browse facets and server pagination', () => {
    const params = new URLSearchParams({
      q: 'family medicine',
      profession: 'physician',
      state: 'ca',
      schedule: 'part_time',
      hiringType: 'locums',
      remote: 'false',
      observedWithin: '7',
      applicationMode: 'external',
      compensation: 'supplied',
      benefits: 'listed',
      sort: 'organization',
      readinessStatus: 'ready_now',
      payMin: '300000',
      page: '3',
    });
    const filters = parseBoardFilters(params);
    const publicUrl = serializeBoardFilters(filters);
    const api = toApiQuery(filters);

    expect(filters).toMatchObject({
      q: 'family medicine',
      profession: 'physician',
      state: 'CA',
      schedule: 'part_time',
      hiringType: 'locums',
      remote: false,
      observedWithin: '7',
      applicationMode: 'external',
      compensation: 'supplied',
      benefits: 'listed',
      sort: 'organization',
      page: 3,
    });
    expect(publicUrl.has('readinessStatus')).toBe(false);
    expect(publicUrl.has('payMin')).toBe(false);
    expect(api.get('q')).toBe('family medicine');
    expect(api.get('profession')).toBe('physician');
    expect(api.get('schedule')).toBe('part_time');
    expect(api.get('remote')).toBe('false');
    expect(api.get('observedWithinDays')).toBe('7');
    expect(api.get('applicationMode')).toBe('external');
    expect(api.get('compensation')).toBe('supplied');
    expect(api.get('benefits')).toBe('listed');
    expect(api.get('sort')).toBe('organization');
    expect(api.get('limit')).toBe('12');
    expect(api.get('offset')).toBe('24');
  });

  it('renders source-honest opportunity lenses as real links without JavaScript', () => {
    const filters = parseBoardFilters(new URLSearchParams());
    const html = renderToStaticMarkup(<OpportunityLensRail filters={filters} />);

    expect(html).toContain('data-testid="opportunity-lens-rail"');
    expect(html).toContain('Fresh from source');
    expect(html).toContain('/explore?observedWithin=7');
    expect(html).toContain('Pay in view');
    expect(html).toContain('compensation=supplied');
    expect(html).toContain('Apply with VitalCV');
    expect(html).toContain('applicationMode=vitalcv');
    expect(html).toContain('They are not personalized recommendations or eligibility decisions.');
    expect(html).not.toMatch(/ready now|automatic eligibility|guaranteed/i);
  });

  it('normalizes a stale shared page to the last real result page', () => {
    expect(clampedBoardPage(99, 25)).toBe(3);
    expect(clampedBoardPage(3, 25)).toBeNull();
    expect(clampedBoardPage(9, 0)).toBe(1);
  });
});
