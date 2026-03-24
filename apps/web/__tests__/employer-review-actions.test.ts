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
    ...overrides,
  };
}

describe('employer review action helpers', () => {
  it('formats the loading labels with persistence-first copy', () => {
    expect(employerReviewLoadingLabel('accept')).toBe('Recording acceptance...');
    expect(employerReviewLoadingLabel('refresh')).toBe('Recording refresh request...');
    expect(employerReviewLoadingLabel('review')).toBe('Recording review routing...');
  });

  it('describes durable accept persistence without implying extra side effects', () => {
    const state = buildState();

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Most recent persisted action: employer acceptance');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('The employer acceptance was persisted and linked to an audit event.');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('Audit event audit-1 was recorded');
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

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Most recent persisted action: refresh request');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('No clinician notification is persisted here yet.');
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

    expect(formatEmployerReviewPersistedLabel(state)).toBe('Most recent persisted action: review routing');
    expect(formatEmployerReviewPersistedDetail(state)).toContain('no durable manual review queue item was created');
  });
});
