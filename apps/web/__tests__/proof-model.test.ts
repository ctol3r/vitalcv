import { describe, expect, it } from 'vitest';
import {
  buildApplicationProofMoments,
  buildClinicianProofSummary,
  buildEmployerApplicationProofMoments,
  buildEmployerProofSummary,
} from '../lib/proof/proof-model';
import type { ClinicianMobileData } from '../lib/mobile/clinician-state';

function buildClinicianData(): ClinicianMobileData {
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
      readinessLevel: 'L3',
      readinessScore: 91,
      readinessStatus: 'Ready to credential - all evidence verified',
      trustBand: 'L3',
      trustScore: 91,
      gapSummary: [],
      computedAt: '2026-03-20T10:00:00.000Z',
      cached: false,
    },
    applications: [
      {
        id: 'app-1',
        opportunityId: 'opp-1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T09:00:00.000Z',
        updatedAt: '2026-03-20T09:30:00.000Z',
        reviewedAt: '2026-03-20T09:30:00.000Z',
        reviewNote: 'Employer review active.',
        employer: { organizationId: 'org-1', name: 'Providence' },
        opportunity: {
          id: 'opp-1',
          organizationId: 'org-1',
          organizationName: 'Providence',
          title: 'ICU Nurse',
          specialty: 'ICU',
          hiringType: 'contract',
          state: 'OR',
          payRange: '$3,600/week',
          status: 'ACTIVE',
        },
        provider: null,
        readiness: {
          readinessScore: 91,
          readinessLevel: 'L3',
          readinessStatus: 'Ready to credential - all evidence verified',
          gapSummary: [],
          keyCredentials: ['State license'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'CONTINUE_REVIEW',
          label: 'Continue review',
          explanation: 'Employer review is active.',
        },
        timeline: [],
        systemBehavesAutonomously: false,
      },
    ],
    opportunities: [],
    missingForHigherMatches: [],
    refreshedAt: '2026-03-20T10:00:00.000Z',
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
    trustHistory: [
      {
        id: 'current',
        npi: '1234567890',
        readinessLevel: 'L3',
        readinessScore: 91,
        readinessStatus: 'Ready to credential - all evidence verified',
        trustBand: 'L3',
        trustScore: 91,
        gapSummary: [],
        computedAt: '2026-03-20T10:00:00.000Z',
        cached: false,
        deltaScore: 6,
        deltaBand: 'up',
        previousLevel: 'L2',
        previousScore: 85,
        newGaps: [],
        resolvedGaps: ['DEA registration not verified', 'Malpractice insurance not on file'],
        reason: 'Resolved dea registration not verified',
      },
      {
        id: 'baseline',
        npi: '1234567890',
        readinessLevel: 'L2',
        readinessScore: 85,
        readinessStatus: 'Mostly ready - minor gaps remain',
        trustBand: 'L2',
        trustScore: 85,
        gapSummary: ['DEA registration not verified', 'Malpractice insurance not on file'],
        computedAt: '2026-03-18T10:00:00.000Z',
        cached: false,
        deltaScore: null,
        deltaBand: null,
        previousLevel: null,
        previousScore: null,
        newGaps: [],
        resolvedGaps: [],
        reason: 'DEA registration not verified',
      },
    ],
    notifications: [],
    blockers: [],
    activeApplications: [],
    availableOpportunities: [],
    recommendedAction: null,
  };
}

describe('proof model helpers', () => {
  it('summarizes clinician outcomes from trust and application state', () => {
    const summary = buildClinicianProofSummary(buildClinicianData());

    expect(summary.blockersResolvedCount).toBe(2);
    expect(summary.readinessDeltaScore).toBe(6);
    expect(summary.applicationsSubmitted).toBe(1);
    expect(summary.applicationsMoving).toBe(1);
    expect(summary.completedWithVitalCv[0]).toContain('Resolved 2 blockers');
    expect(summary.recentChanges[0]?.summary).toContain('moved to');
  });

  it('builds factual application proof moments', () => {
    const application = buildClinicianData().applications[0]!;
    const moments = buildApplicationProofMoments(application);

    expect(moments[0]).toContain('Submitted with L3 91/100 readiness');
    expect(moments[1]).toContain('Employer review started');
  });

  it('builds employer value signals from visible candidate state', () => {
    const application = buildClinicianData().applications[0]!;
    const summary = buildEmployerProofSummary({
      applications: [application],
      findingCount: 2,
      storylineCount: 1,
      actionCount: 3,
    });

    expect(summary.readinessVisibleCount).toBe(1);
    expect(summary.readyCandidatesCount).toBe(1);
    expect(summary.preparedReviewCount).toBe(1);
    expect(summary.reviewActionCount).toBe(1);
    expect(summary.findingsVisibleCount).toBe(2);
    expect(summary.actionQueueCount).toBe(3);
  });

  it('describes employer-facing proof moments without inventing ROI', () => {
    const application = buildClinicianData().applications[0]!;
    const moments = buildEmployerApplicationProofMoments(application);

    expect(moments[0]).toContain('Readiness visible at L3 91/100');
    expect(moments.some((moment) => moment.includes('prepared before manual review'))).toBe(true);
  });
});
