import { describe, expect, it } from 'vitest';
import {
  employerReviewLoadingLabel,
  formatEmployerReviewPersistedDetail,
  formatEmployerReviewPersistedLabel,
  type EmployerReviewActionState,
} from '../lib/employer-review-actions';

function buildState(overrides: Partial<EmployerReviewActionState> = {}): EmployerReviewActionState {
  return {
    action: 'accept',
    entityId: 'entity-1',
    clinicianNpi: '1234567890',
    auditEventId: 'audit-1',
    timestamp: '2026-03-23T20:00:00.000Z',
    persistence: {
      mode: 'durable_record',
      target: 'employer_acceptance',
      acceptanceId: 'accept-1',
      reviewItemId: null,
      reviewItemCreated: false,
    },
    summary: {
      title: 'Head start accepted',
      description: 'The employer acceptance was persisted and linked to an audit event.',
    },
    details: {
      staleSources: [],
      missingDomains: [],
      reason: null,
      priority: null,
    },
    trustSnapshot: {
      snapshotHash: 'snap_hash_1234567890abcdef',
      capturedAt: '2026-03-23T20:00:00.000Z',
      npi: '1234567890',
      readinessStatus: 'PARTIAL',
      readinessScore: 88,
      readinessLevel: 'L2',
      trustBand: 'L2',
      trustBandLabel: 'Moderate trust',
      trustScore: 88,
      trustScoreConfidence: 0.91,
      exclusionStatus: 'CLEAR',
      exclusionCheckedAt: '2026-03-23T19:30:00.000Z',
      pecosEnrollmentStatus: 'ENROLLED',
      verifiedCredentialCount: 2,
      staleCredentialCount: 0,
      reviewRequiredCount: 0,
      blockerCount: 0,
      topBlockers: [],
      missingDomains: [],
      gatedDomains: [],
      lastCheckedAt: '2026-03-23T19:30:00.000Z',
    },
    ...overrides,
  };
}

describe('employer review action helpers', () => {
  it('formats the loading labels with persistence-first copy', () => {
    expect(employerReviewLoadingLabel('accept')).toBe('Saving acceptance...');
    expect(employerReviewLoadingLabel('refresh')).toBe('Saving request for updated data...');
    expect(employerReviewLoadingLabel('review')).toBe('Saving review flag...');
  });

  it('describes durable accept persistence without implying extra side effects', () => {
    const state = buildState();

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Latest confirmed action: accepted as head start');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('The employer acceptance was persisted and linked to an audit event.');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('Acceptance record accept-1 was stored.');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('Audit event audit-1 was recorded Mar 23, 2026');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('Trust snapshot snap_hash_12');
  });

  it('describes audit-only refresh persistence honestly', () => {
    const state = buildState({
      action: 'refresh',
      persistence: {
        mode: 'audit_only',
        target: 'audit_event',
        acceptanceId: null,
        reviewItemId: null,
        reviewItemCreated: false,
      },
      summary: {
        title: 'Refresh request recorded',
        description: 'The refresh request was persisted in the audit trail. No clinician notification is persisted here yet.',
      },
    });

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Latest confirmed action: requested updated data');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('No clinician notification is persisted here yet.');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('saved the audit trail only');
  });

  it('describes audit-only review routing without claiming a queue item exists', () => {
    const state = buildState({
      action: 'review',
      persistence: {
        mode: 'audit_only',
        target: 'audit_event',
        acceptanceId: null,
        reviewItemId: null,
        reviewItemCreated: false,
      },
      summary: {
        title: 'Review routing recorded',
        description: 'The routing decision was persisted in the audit trail, but no durable manual review queue item was created in this environment.',
      },
    });

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Latest confirmed action: flagged for review');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('no durable manual review queue item was created');
  });

  it('confirms when review routing created a durable queue item', () => {
    const state = buildState({
      action: 'review',
      persistence: {
        mode: 'durable_record',
        target: 'review_queue_item',
        acceptanceId: null,
        reviewItemId: 'review-1',
        reviewItemCreated: true,
      },
      summary: {
        title: 'Review queue created',
        description: 'The routing decision was persisted and a manual review item is now open.',
      },
    });

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Latest confirmed action: flagged for review');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('Review queue item review-1 was created.');
  });
});
