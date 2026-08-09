/**
 * work-ledger.test.ts — A3. The home ledger renders recorded events only,
 * with the controller preserved (EC-7) and no invented agency (EC-8).
 */
import { describe, expect, it } from 'vitest';
import { buildWorkLedger } from '../lib/mobile/work-ledger';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

function base(): ClinicianMobileData {
  return {
    signedIn: true,
    workspace: null,
    trustState: null,
    applications: [],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-08-08T10:00:00.000Z',
    profileCompleteness: null,
    trustHistory: [],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: null,
  };
}

describe('buildWorkLedger', () => {
  it('returns nothing when nothing was recorded', () => {
    expect(buildWorkLedger(base())).toEqual([]);
  });

  it('labels an application-status notification as the employer’s move, others as changes', () => {
    const data = base();
    data.notifications = [
      {
        id: 'n1',
        type: 'application_status_changed',
        occurredAt: '2026-08-08T09:00:00.000Z',
        title: 'Application reviewed',
        body: 'Travel ICU Nurse is now in review.',
        href: '/holder/applications',
        ctaLabel: 'Open updates',
        relatedBlockerId: null,
        relatedApplicationId: 'app_1',
        relatedOpportunityId: 'opp_1',
      },
      {
        id: 'n2',
        type: 'readiness_recomputed',
        occurredAt: '2026-08-08T08:00:00.000Z',
        title: 'New information was found',
        body: 'A source responded.',
        href: '/holder/readiness',
        ctaLabel: 'Open readiness',
        relatedBlockerId: null,
        relatedApplicationId: null,
        relatedOpportunityId: null,
      },
    ] as ClinicianMobileData['notifications'];

    const ledger = buildWorkLedger(data);
    expect(ledger.map((e) => e.state)).toEqual(['employer', 'changed']);
    expect(ledger[0].word).toBe('Employer decides');
    expect(ledger[1].word).toBe('Something changed');
  });

  it('excludes standing states — a missing item is not an event', () => {
    const data = base();
    data.notifications = [
      {
        id: 'standing',
        type: 'missing_item_detected',
        occurredAt: '2026-08-08T09:00:00.000Z',
        title: 'Credential evidence missing',
        body: 'Your readiness needs credential evidence attached.',
        href: '/holder/blockers/x',
        ctaLabel: 'Upload evidence',
        relatedBlockerId: 'x',
        relatedApplicationId: null,
        relatedOpportunityId: null,
      },
    ] as ClinicianMobileData['notifications'];
    expect(buildWorkLedger(data)).toEqual([]);
  });

  it('keeps readiness recomputations as observations — never invented agency (DL-007)', () => {
    const data = base();
    data.trustHistory = [
      {
        id: 'h1',
        npi: '1234567890',
        readinessLevel: 'L3',
        readinessScore: 91,
        readinessStatus: 'Ready',
        trustBand: 'L3',
        trustScore: 91,
        gapSummary: [],
        computedAt: '2026-08-08T09:30:00.000Z',
        cached: false,
        deltaScore: 6,
        deltaBand: 'up',
        previousLevel: 'L2',
        previousScore: 85,
        newGaps: [],
        resolvedGaps: ['DEA registration not verified'],
        reason: 'Resolved dea registration not verified',
      },
      {
        id: 'h2',
        npi: '1234567890',
        readinessLevel: 'L2',
        readinessScore: 85,
        readinessStatus: 'Mostly ready',
        trustBand: 'L2',
        trustScore: 85,
        gapSummary: ['DEA registration not verified'],
        computedAt: '2026-08-08T07:00:00.000Z',
        cached: false,
        deltaScore: null,
        deltaBand: null,
        previousLevel: null,
        previousScore: null,
        newGaps: [],
        resolvedGaps: [],
        reason: null,
      },
    ] as ClinicianMobileData['trustHistory'];

    const ledger = buildWorkLedger(data);
    expect(ledger[0].state).toBe('changed');
    expect(ledger[0].title).toContain('DEA registration not verified');
    expect(ledger[1].state).toBe('changed');
    // No source in ClinicianMobileData records VitalCV's own completed
    // action, so no entry may claim one.
    expect(ledger.every((e) => e.state !== 'did' && e.state !== 'prepared')).toBe(true);
  });

  it('sorts descending by time, drops undated events, and honors the limit', () => {
    const data = base();
    data.notifications = [
      {
        id: 'undated',
        type: 'x',
        occurredAt: '',
        title: 'No timestamp',
        body: 'Must not appear.',
        href: null,
        ctaLabel: null,
        relatedBlockerId: null,
        relatedApplicationId: null,
        relatedOpportunityId: null,
      },
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `n${i}`,
        type: 'generic',
        occurredAt: `2026-08-0${(i % 7) + 1}T0${i}:00:00.000Z`,
        title: `Event ${i}`,
        body: 'Recorded.',
        href: null,
        ctaLabel: null,
        relatedBlockerId: null,
        relatedApplicationId: null,
        relatedOpportunityId: null,
      })),
    ] as ClinicianMobileData['notifications'];

    const ledger = buildWorkLedger(data);
    expect(ledger).toHaveLength(6);
    const times = ledger.map((e) => Date.parse(e.occurredAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    expect(ledger.some((e) => e.title === 'No timestamp')).toBe(false);
  });
});
