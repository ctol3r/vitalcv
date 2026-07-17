// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ClinicianSwipeBoard, actionForDirection } from '../components/mobile/ClinicianSwipeBoard';
import type { MobileOpportunityCard } from '../lib/mobile/dashboard';

vi.mock('../components/mobile/ClinicianMobileProvider', () => ({
  useClinicianMobile: () => ({
    data: { workspace: null, activeApplications: [] },
    applySubmitted: vi.fn(),
    selectOpportunity: vi.fn(),
  }),
}));

vi.mock('../components/matcha/useOpportunityActions', () => ({
  useOpportunityActions: () => ({
    loaded: true,
    bucketOf: () => 'new',
    setStatus: vi.fn(),
    counts: () => ({ new: 1, saved: 0, connected: 0, declined: 0 }),
  }),
}));

vi.mock('../components/explore/ApplyModal', () => ({ default: () => null }));
vi.mock('../components/mobile/ClinicianStatusBanner', () => ({ ClinicianStatusBanner: () => null }));

function opportunity(): MobileOpportunityCard {
  return {
    id: 'opp-1',
    organizationId: 'org-1',
    organizationName: 'Northstar Medical',
    organizationSlug: 'northstar-medical',
    title: 'Emergency Physician',
    specialty: 'Emergency Medicine',
    hiringType: 'PERMANENT',
    state: 'CA',
    payRange: '$260k–$310k',
    requirementLevel: 'L2',
    description: 'A live role with a source-attributed requirements comparison.',
    remote: false,
    status: 'ACTIVE',
    createdAt: '2026-07-15T12:00:00.000Z',
    application: null,
    match: {
      opportunityId: 'opp-1',
      band: 'NEAR_CLEAR',
      score: 86,
      blockers: [],
      fitReasons: ['Specialty aligns'],
    },
  };
}

describe('clinician swipe board', () => {
  it('maps directional gestures to the existing decision contract', () => {
    expect(actionForDirection('right')).toBe('connected');
    expect(actionForDirection('left')).toBe('declined');
  });

  it('keeps the three explicit decisions and keyboard guidance in the DOM', () => {
    const markup = renderToStaticMarkup(<ClinicianSwipeBoard opportunities={[opportunity()]} />);
    expect(markup).toContain('Maybe later');
    expect(markup).toContain('Yes');
    expect(markup).toContain('No');
    expect(markup).toContain('ArrowLeft');
    expect(markup).toContain('aria-roledescription="job opportunity"');
    expect(markup).toContain('A live role with a source-attributed requirements comparison.');
  });
});
