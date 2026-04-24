import { describe, expect, it } from 'vitest';
import { summarizeDeterministicDecision } from '@vitalcv/trust-state';
import { getDecisionSummary } from '@/lib/apply/decision-summary';

describe('getDecisionSummary', () => {
  it('keeps unknown snapshots free of blockers when there is no adverse evidence', () => {
    const summary = getDecisionSummary({
      status: 'unknown',
      blockers: [],
      nextAction: null,
      snapshot: {
        claims: [],
        limitations: [
          {
            state: 'pending',
            label: 'Primary checks still pending',
            detail: 'These checks have not completed yet.',
          },
        ],
      },
    });

    expect(summary.proven).toEqual([]);
    expect(summary.missing).toEqual(['Primary checks still pending']);
    expect(summary.blockers).toEqual([]);
    expect(summary.nextAction).toBe('Wait for the first verified source before making a decision.');
  });

  it('matches the shared deterministic decision contract for partial snapshots', () => {
    const summary = getDecisionSummary({
      status: 'partial',
      blockers: [],
      nextAction: null,
      standing: {
        deaStatus: 'registered',
        licenseStatus: 'pending',
        exclusionStatus: 'CLEAR',
      },
      snapshot: {
        claims: [
          {
            credentialType: 'STATE_LICENSE',
            issuer: 'California Medical Board',
            status: 'VERIFIED',
          },
        ],
        limitations: [
          {
            state: 'pending',
            label: 'Medicare enrollment still pending',
            detail: 'PECOS is still pending.',
          },
        ],
      },
    });

    const shared = summarizeDeterministicDecision({
      verifiedEvidenceCount: 1,
      limitationLabels: ['Medicare enrollment still pending'],
      explicitBlockers: [],
      deaStatus: 'registered',
      licenseStatus: 'pending',
      exclusionStatus: 'CLEAR',
    });

    expect(summary.state).toBe(shared.state);
    expect(summary.blockers).toEqual(shared.blockers);
    expect(summary.nextAction).toBe(shared.nextAction);
  });

  it('blocks the UI summary when DEA standing is expired', () => {
    const summary = getDecisionSummary({
      status: 'partial',
      blockers: [],
      nextAction: null,
      standing: {
        deaStatus: 'expired',
        licenseStatus: 'verified',
        exclusionStatus: 'CLEAR',
      },
      snapshot: {
        claims: [
          {
            credentialType: 'STATE_LICENSE',
            issuer: 'California Medical Board',
            status: 'VERIFIED',
          },
        ],
        limitations: [],
      },
    });

    expect(summary.state).toBe('blocked');
    expect(summary.blockers).toContain('DEA registration expired');
  });

  it('surfaces institutional-access sequencing for access-required cases', () => {
    const summary = getDecisionSummary({
      status: 'partial',
      blockers: [],
      nextAction: null,
      snapshot: {
        claims: [
          {
            credentialType: 'NPPES_IDENTITY',
            issuer: 'CMS NPPES',
            status: 'VERIFIED',
          },
        ],
        limitations: [
          {
            state: 'access_required',
            label: 'State board access required',
            detail: 'Washington requires institutional access before license verification can run.',
          },
        ],
      },
    });

    expect(summary.state).toBe('partial');
    expect(summary.nextAction).toContain('institutional access');
    expect(summary.nextAction).toContain('credentialing review');
  });

  it('surfaces manual-review sequencing for conflicting records', () => {
    const summary = getDecisionSummary({
      status: 'partial',
      blockers: [],
      nextAction: null,
      snapshot: {
        claims: [
          {
            credentialType: 'STATE_LICENSE',
            issuer: 'Illinois Medical Board',
            status: 'VERIFIED',
          },
        ],
        limitations: [
          {
            state: 'review_required',
            label: 'Conflicting authority record',
            detail: 'Board order details still need manual adjudication.',
          },
        ],
      },
    });

    expect(summary.state).toBe('partial');
    expect(summary.nextAction).toContain('Manual credentialing review');
    expect(summary.nextAction).toContain('adjudicated');
  });
});
