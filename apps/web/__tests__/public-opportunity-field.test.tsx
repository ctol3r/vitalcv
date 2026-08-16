import { formatUnstatedFields, opportunityRowFacts } from '@/lib/explore/opportunity-display';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BoardResultRow } from '@/components/explore/board/BoardResultRow';
import { OpportunityLensRail } from '@/components/explore/board/OpportunityLensRail';
import {
  activeFilterSummary,
  clampedBoardPage,
  clearFilter,
  hasActiveFilters,
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
    // The silence is still disclosed — it moved from a fact cell (and a
    // duplicate provenance cell) into the one line that names every field the
    // source left empty. Collapsing must never mean concealing.
    expect(html).toContain('Source didn');
    expect(html).toContain('compensation');
    // ...and the duplicate provenance cell is gone with no pay to source.
    expect(html).not.toContain('Compensation source');
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
    // readinessStatus is a signed-in facet the public board does not carry, so
    // it is still dropped. payMin is no longer in that category — it is a real
    // facet now and must survive the round trip.
    expect(publicUrl.has('readinessStatus')).toBe(false);
    expect(publicUrl.get('payMin')).toBe('300000');
    expect(api.get('payMin')).toBe('300000');
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

  it('carries every facet the opportunity API actually implements', () => {
    // The panel used to expose eleven facets over an API that serves nineteen.
    // These are the five that were unreachable and that live data can populate.
    // payModel is deliberately absent — see the pay-basis removal.
    const filters = parseBoardFilters(new URLSearchParams({
      payMin: '120',
      payMax: '260',
      visaSponsorship: 'available',
      startUrgency: 'immediate',
      employerType: 'telehealth',
      organizationSlug: 'example-clinical-organization',
    }));
    const api = toApiQuery(filters);

    expect(api.get('payMin')).toBe('120');
    expect(api.get('payMax')).toBe('260');
    expect(api.get('visaSponsorship')).toBe('available');
    expect(api.get('startUrgency')).toBe('immediate');
    expect(api.get('employerType')).toBe('telehealth');
    expect(api.get('organizationSlug')).toBe('example-clinical-organization');
    expect(hasActiveFilters(filters)).toBe(true);

    // Every one of them is individually removable from the chip row.
    for (const { key } of activeFilterSummary(filters)) {
      expect(toApiQuery(clearFilter(filters, key)).has(String(key))).toBe(false);
    }
  });

  it('refuses a pay bound that would silently drop unpublished pay', () => {
    // Zero is the dangerous one: it is a real filter the API would honour, and
    // it excludes every role that published no pay at all. Treat it as unset.
    expect(parseBoardFilters(new URLSearchParams({ payMin: '0' })).payMin).toBe('');
    expect(parseBoardFilters(new URLSearchParams({ payMin: '-40' })).payMin).toBe('');
    expect(parseBoardFilters(new URLSearchParams({ payMax: '12e4' })).payMax).toBe('');
    expect(parseBoardFilters(new URLSearchParams({ payMax: '99999999999' })).payMax).toBe('');

    // A reversed window is an impossible one; read it the way it was meant.
    const reversed = parseBoardFilters(new URLSearchParams({ payMin: '300000', payMax: '100000' }));
    expect([reversed.payMin, reversed.payMax]).toEqual(['100000', '300000']);
  });

  it('only accepts an employer slug shaped like one of ours', () => {
    expect(parseBoardFilters(new URLSearchParams({ organizationSlug: 'Good-Slug-1' })).organizationSlug)
      .toBe('good-slug-1');
    expect(parseBoardFilters(new URLSearchParams({ organizationSlug: '../etc/passwd' })).organizationSlug)
      .toBe('');
    expect(parseBoardFilters(new URLSearchParams({ organizationSlug: '-leading-dash' })).organizationSlug)
      .toBe('');
  });

  it('lets a reader narrow the field to one employer from a result row', () => {
    const picked: string[] = [];
    const html = renderToStaticMarkup(
      <BoardResultRow opportunity={externalRole()} ordinal={1} onFilterEmployer={(s) => picked.push(s)} />,
    );
    expect(html).toContain('Show only roles at Example clinical organization');

    // Without the callback the name stays plain text — no dead control on a row
    // that has nothing to filter.
    const plain = renderToStaticMarkup(<BoardResultRow opportunity={externalRole()} ordinal={1} />);
    expect(plain).not.toContain('opf-role-org-filter');
    expect(plain).toContain('Example clinical organization');
    expect(picked).toEqual([]);
  });

  it('normalizes a stale shared page to the last real result page', () => {
    expect(clampedBoardPage(99, 25)).toBe(3);
    expect(clampedBoardPage(3, 25)).toBeNull();
    expect(clampedBoardPage(9, 0)).toBe(1);
  });
});

describe('collapsed silence line', () => {
  it('names every field the source left empty, and no field it filled', () => {
    // The row's density fix must not become a disclosure fix. A field the
    // source DID state belongs in the fact list; one it did not belongs in
    // the sentence — and nothing may fall out of both.
    const facts = opportunityRowFacts({
      ...externalRole(),
      profession: 'nursing',
      state: 'TX',
      remote: false,
      schedule: null,
      specialty: 'Not stated',
      compensationProvenance: { state: 'not_supplied' },
      payRange: null,
      payRangeMin: null,
      payRangeMax: null,
    } as never);

    expect(facts.stated.map((f) => f.label)).toEqual(['Profession', 'Location', 'Employment']);
    expect(facts.unstated).toEqual(['schedule', 'specialty', 'compensation']);
    // Six fields in, six fields out — collapsing loses nothing.
    expect(facts.stated.length + facts.unstated.length).toBe(6);
  });

  it('compares the placeholder as a whole string, never a substring', () => {
    // Contains the placeholder EXACTLY ('Not stated'), and is still a real
    // value the employer wrote. A substring test would call this silence and
    // hide a stated specialty inside the "didn't state" sentence.
    const facts = opportunityRowFacts({
      ...externalRole(),
      specialty: 'Not stated on the source posting, confirmed by phone',
    } as never);
    expect(facts.unstated).not.toContain('specialty');
    expect(facts.stated.map((f) => f.label)).toContain('Specialty');
  });

  it('joins the list as a person would read it', () => {
    expect(formatUnstatedFields(['schedule'])).toBe('schedule');
    expect(formatUnstatedFields(['schedule', 'specialty'])).toBe('schedule and specialty');
    expect(formatUnstatedFields(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
