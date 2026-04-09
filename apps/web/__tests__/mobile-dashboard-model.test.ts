import { describe, expect, it } from 'vitest';
import { buildClinicianMobileData } from '../lib/mobile/clinician-state';
import {
  buildMobileOpportunityCards,
  normalizeClinicianApplications,
  normalizeMobileTrustState,
} from '../lib/mobile/dashboard';

describe('mobile dashboard model helpers', () => {
  it('normalizes trust-state aliases into the mobile shape', () => {
    const state = normalizeMobileTrustState({
      npi: '1234567890',
      readiness_level: 'L3',
      readiness_score: 94,
      readiness_status: 'Ready to credential',
      trustBand: 'L3',
      trustScore: 94,
      gap_summary: ['DEA registration missing'],
      computedAt: '2026-03-20T12:00:00.000Z',
      cached: true,
    });

    expect(state).toEqual({
      npi: '1234567890',
      readinessLevel: 'L3',
      readinessScore: 94,
      readinessStatus: 'Ready to credential',
      trustBand: 'L3',
      trustScore: 94,
      gapSummary: ['DEA registration missing'],
      computedAt: '2026-03-20T12:00:00.000Z',
      cached: true,
    });
  });

  it('keeps application employer and readiness context intact', () => {
    const applications = normalizeClinicianApplications([
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-18T12:00:00.000Z',
        updatedAt: '2026-03-19T15:00:00.000Z',
        employer: {
          organizationId: 'org_1',
          name: 'Bay Area Cardiac Group',
        },
        opportunity: {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Bay Area Cardiac Group',
          title: 'Cardiology Lead',
          specialty: 'Cardiology',
          hiringType: 'perm',
          state: 'CA',
          payRange: '$320k-$360k',
          status: 'ACTIVE',
        },
        readiness: {
          readinessScore: 91,
          readinessLevel: 'L3',
          readinessStatus: 'Ready to credential',
          gapSummary: [],
          keyCredentials: ['State license'],
          trustSignals: ['NPI identity verified'],
        },
      },
    ]);

    expect(applications[0]).toMatchObject({
      status: 'REVIEWED',
      employer: { name: 'Bay Area Cardiac Group' },
      opportunity: { title: 'Cardiology Lead', state: 'CA' },
      readiness: { readinessLevel: 'L3', readinessScore: 91 },
    });
  });

  it('attaches applications and match priority to live opportunities', () => {
    const cards = buildMobileOpportunityCards({
      opportunities: [
        {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Bay Area Cardiac Group',
          organizationSlug: 'bay-area-cardiac-group',
          title: 'Cardiology Lead',
          specialty: 'Cardiology',
          hiringType: 'perm',
          state: 'CA',
          payRange: '$320k-$360k',
          requirementLevel: 'L3',
          description: null,
          remote: false,
          status: 'ACTIVE',
          createdAt: '2026-03-18T12:00:00.000Z',
        },
        {
          id: 'opp_2',
          organizationId: 'org_2',
          organizationName: 'MindBridge Health',
          organizationSlug: 'mindbridge-health',
          title: 'Telepsychiatry Director',
          specialty: 'Psychiatry',
          hiringType: 'telehealth',
          state: 'CA',
          payRange: '$280k-$310k',
          requirementLevel: 'L2',
          description: null,
          remote: true,
          status: 'ACTIVE',
          createdAt: '2026-03-20T12:00:00.000Z',
        },
      ],
      applications: normalizeClinicianApplications([
        {
          id: 'app_1',
          opportunityId: 'opp_2',
          status: 'PENDING',
          createdAt: '2026-03-20T13:00:00.000Z',
          updatedAt: '2026-03-20T13:00:00.000Z',
          employer: { organizationId: 'org_2', name: 'MindBridge Health' },
          opportunity: {
            id: 'opp_2',
            organizationId: 'org_2',
            organizationName: 'MindBridge Health',
            title: 'Telepsychiatry Director',
            specialty: 'Psychiatry',
            hiringType: 'telehealth',
            state: 'CA',
            payRange: '$280k-$310k',
            status: 'ACTIVE',
          },
        },
      ]),
      matchPayload: {
        npi: '1234567890',
        clinicianName: 'Ada Lovelace',
        specialty: 'Psychiatry',
        state: 'CA',
        missingForHigherMatches: [],
        matches: [
          {
            opportunityId: 'opp_2',
            band: 'CLEAR',
            score: 98,
            blockers: [],
            fitReasons: ['Telehealth ready'],
          },
        ],
      },
      specialty: 'Psychiatry',
      state: 'CA',
    });

    expect(cards[0]?.id).toBe('opp_2');
    expect(cards[0]?.match?.score).toBe(98);
    expect(cards[0]?.application?.status).toBe('PENDING');
  });

  it('builds structured blockers and deep-linkable notifications for the clinician loop', () => {
    const applications = normalizeClinicianApplications([
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T13:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
        reviewedAt: '2026-03-20T09:00:00.000Z',
        reviewNote: 'Need updated license evidence.',
        employer: { organizationId: 'org_1', name: 'Bay Area Cardiac Group' },
        opportunity: {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Bay Area Cardiac Group',
          title: 'Cardiology Lead',
          specialty: 'Cardiology',
          hiringType: 'perm',
          state: 'CA',
          payRange: '$320k-$360k',
          status: 'ACTIVE',
        },
        readiness: {
          readinessScore: 84,
          readinessLevel: 'L2',
          readinessStatus: 'Mostly ready - missing evidence',
          gapSummary: ['State license evidence missing'],
          keyCredentials: ['NPI identity verified'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'UPLOAD_EVIDENCE',
          label: 'Upload license evidence',
          explanation: 'Employer review cannot proceed until updated license evidence is attached.',
        },
        timeline: [
          {
            stage: 'REVIEWED',
            occurredAt: '2026-03-20T09:00:00.000Z',
            description: 'Employer review requested updated evidence.',
          },
        ],
        systemBehavesAutonomously: false,
      },
    ]);

    const data = buildClinicianMobileData({
      base: {
        signedIn: true,
        workspace: {
          personProfile: {
            npi: '1234567890',
            firstName: 'Ada',
            lastName: 'Lovelace',
            specialty: 'Cardiology',
            stateOfPractice: 'CA',
            completeness: 82,
          },
        },
        trustState: normalizeMobileTrustState({
          npi: '1234567890',
          readiness_level: 'L2',
          readiness_score: 84,
          readiness_status: 'Mostly ready - missing evidence',
          trustBand: 'L2',
          trustScore: 84,
          gap_summary: ['DEA verification pending'],
          computedAt: '2026-03-20T10:00:00.000Z',
        }),
        applications,
        opportunities: [],
        missingForHigherMatches: [],
        refreshedAt: '2026-03-20T10:00:00.000Z',
      },
      profileCompleteness: {
        score: 82,
        dimensions: {
          npiVerified: true,
          resumeUploaded: true,
          linksAdded: true,
          workAuthProvided: true,
          credentialsImported: false,
        },
      },
      rawTrustHistory: [],
    });

    expect(data.blockers[0]?.href).toContain('/holder/blockers/');
    expect(data.blockers.some((blocker) => blocker.relatedApplicationId === 'app_1')).toBe(true);
    expect(data.notifications.some((notification) => notification.relatedBlockerId !== null)).toBe(true);
    expect(data.notifications.some((notification) => notification.href === '/holder/applications/app_1')).toBe(true);
    expect(data.notifications.find((notification) => notification.relatedBlockerId)?.ctaLabel).toBe('Upload evidence');
    expect(data.recommendedAction).toMatchObject({
      kind: 'resolve_gap',
      ctaLabel: 'Upload evidence',
    });
  });

  it('keeps the holder next action anchored to an in-flight application when only generic blockers remain', () => {
    const applications = normalizeClinicianApplications([
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T13:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
        reviewedAt: '2026-03-20T09:00:00.000Z',
        employer: { organizationId: 'org_1', name: 'Bay Area Cardiac Group' },
        opportunity: {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Bay Area Cardiac Group',
          title: 'Cardiology Lead',
          specialty: 'Cardiology',
          hiringType: 'perm',
          state: 'CA',
          payRange: '$320k-$360k',
          status: 'ACTIVE',
        },
        readiness: {
          readinessScore: 84,
          readinessLevel: 'L2',
          readinessStatus: 'Mostly ready - missing evidence',
          gapSummary: [],
          keyCredentials: ['NPI identity verified'],
          trustSignals: ['NPI identity verified'],
        },
      },
    ]);

    const data = buildClinicianMobileData({
      base: {
        signedIn: true,
        workspace: {
          personProfile: {
            npi: '1234567890',
            firstName: 'Ada',
            lastName: 'Lovelace',
            specialty: 'Cardiology',
            stateOfPractice: 'CA',
            completeness: 88,
          },
        },
        trustState: normalizeMobileTrustState({
          npi: '1234567890',
          readiness_level: 'L2',
          readiness_score: 84,
          readiness_status: 'Mostly ready - missing evidence',
          trustBand: 'L2',
          trustScore: 84,
          gap_summary: ['DEA verification pending'],
          computedAt: '2026-03-20T10:00:00.000Z',
        }),
        applications,
        opportunities: [],
        missingForHigherMatches: [],
        refreshedAt: '2026-03-20T10:00:00.000Z',
      },
      profileCompleteness: {
        score: 88,
        dimensions: {
          npiVerified: true,
          resumeUploaded: true,
          linksAdded: true,
          workAuthProvided: true,
          credentialsImported: true,
        },
      },
      rawTrustHistory: [],
    });

    expect(data.blockers[0]?.label).toBe('DEA verification pending');
    expect(data.recommendedAction).toMatchObject({
      kind: 'view_application',
      href: '/holder/applications/app_1',
      ctaLabel: 'View application',
    });
  });

  it('keeps an application-specific blocker as the holder next action after apply', () => {
    const applications = normalizeClinicianApplications([
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'REVIEWED',
        createdAt: '2026-03-19T13:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
        reviewedAt: '2026-03-20T09:00:00.000Z',
        employer: { organizationId: 'org_1', name: 'Bay Area Cardiac Group' },
        opportunity: {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Bay Area Cardiac Group',
          title: 'Cardiology Lead',
          specialty: 'Cardiology',
          hiringType: 'perm',
          state: 'CA',
          payRange: '$320k-$360k',
          status: 'ACTIVE',
        },
        readiness: {
          readinessScore: 84,
          readinessLevel: 'L2',
          readinessStatus: 'Mostly ready - missing evidence',
          gapSummary: ['State license evidence missing'],
          keyCredentials: ['NPI identity verified'],
          trustSignals: ['NPI identity verified'],
        },
        latestRecommendation: {
          actionType: 'UPLOAD_EVIDENCE',
          label: 'Upload license evidence',
          explanation: 'Employer review cannot proceed until updated license evidence is attached.',
        },
      },
    ]);

    const data = buildClinicianMobileData({
      base: {
        signedIn: true,
        workspace: {
          personProfile: {
            npi: '1234567890',
            firstName: 'Ada',
            lastName: 'Lovelace',
            specialty: 'Cardiology',
            stateOfPractice: 'CA',
            completeness: 88,
          },
        },
        trustState: normalizeMobileTrustState({
          npi: '1234567890',
          readiness_level: 'L2',
          readiness_score: 84,
          readiness_status: 'Mostly ready - missing evidence',
          trustBand: 'L2',
          trustScore: 84,
          gap_summary: [],
          computedAt: '2026-03-20T10:00:00.000Z',
        }),
        applications,
        opportunities: [],
        missingForHigherMatches: [],
        refreshedAt: '2026-03-20T10:00:00.000Z',
      },
      profileCompleteness: {
        score: 88,
        dimensions: {
          npiVerified: true,
          resumeUploaded: true,
          linksAdded: true,
          workAuthProvided: true,
          credentialsImported: true,
        },
      },
      rawTrustHistory: [],
    });

    expect(data.recommendedAction).toMatchObject({
      kind: 'resolve_gap',
      ctaLabel: 'Upload evidence',
    });
  });

  it('keeps the holder next action anchored to the in-flight application even when new roles remain visible', () => {
    const applications = normalizeClinicianApplications([
      {
        id: 'app_1',
        opportunityId: 'opp_1',
        status: 'PENDING',
        createdAt: '2026-03-19T13:00:00.000Z',
        updatedAt: '2026-03-20T09:00:00.000Z',
        employer: { organizationId: 'org_1', name: 'Bay Area Cardiac Group' },
        opportunity: {
          id: 'opp_1',
          organizationId: 'org_1',
          organizationName: 'Bay Area Cardiac Group',
          title: 'Cardiology Lead',
          specialty: 'Cardiology',
          hiringType: 'perm',
          state: 'CA',
          payRange: '$320k-$360k',
          status: 'ACTIVE',
        },
        readiness: {
          readinessScore: 91,
          readinessLevel: 'L3',
          readinessStatus: 'Ready to credential',
          gapSummary: [],
          keyCredentials: ['State license'],
          trustSignals: ['NPI identity verified'],
        },
      },
    ]);

    const opportunities = buildMobileOpportunityCards({
      opportunities: [
        {
          id: 'opp_2',
          organizationId: 'org_2',
          organizationName: 'MindBridge Health',
          organizationSlug: 'mindbridge-health',
          title: 'Telepsychiatry Director',
          specialty: 'Psychiatry',
          hiringType: 'telehealth',
          state: 'CA',
          payRange: '$280k-$310k',
          requirementLevel: 'L2',
          description: null,
          remote: true,
          status: 'ACTIVE',
          createdAt: '2026-03-20T12:00:00.000Z',
        },
      ],
      applications,
      matchPayload: {
        npi: '1234567890',
        clinicianName: 'Ada Lovelace',
        specialty: 'Cardiology',
        state: 'CA',
        missingForHigherMatches: [],
        matches: [
          {
            opportunityId: 'opp_2',
            band: 'CLEAR',
            score: 98,
            blockers: [],
            fitReasons: ['Telehealth ready'],
          },
        ],
      },
      specialty: 'Cardiology',
      state: 'CA',
    });

    const data = buildClinicianMobileData({
      base: {
        signedIn: true,
        workspace: {
          personProfile: {
            npi: '1234567890',
            firstName: 'Ada',
            lastName: 'Lovelace',
            specialty: 'Cardiology',
            stateOfPractice: 'CA',
            completeness: 88,
          },
        },
        trustState: normalizeMobileTrustState({
          npi: '1234567890',
          readiness_level: 'L3',
          readiness_score: 91,
          readiness_status: 'Ready to credential',
          trustBand: 'L3',
          trustScore: 91,
          gap_summary: [],
          computedAt: '2026-03-20T10:00:00.000Z',
        }),
        applications,
        opportunities,
        missingForHigherMatches: [],
        refreshedAt: '2026-03-20T10:00:00.000Z',
      },
      profileCompleteness: {
        score: 88,
        dimensions: {
          npiVerified: true,
          resumeUploaded: true,
          linksAdded: true,
          workAuthProvided: true,
          credentialsImported: true,
        },
      },
      rawTrustHistory: [],
    });

    expect(data.recommendedAction).toMatchObject({
      kind: 'view_application',
      href: '/holder/applications/app_1',
      ctaLabel: 'View application',
    });
  });
});
