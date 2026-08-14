jest.mock('../../../graphql/prisma_client', () => ({ __esModule: true, default: {} }));

import {
  buildOpportunityTruth,
  type ClinicianOpportunityProfile,
  type OpportunityTruthRecord,
} from '../../opportunities/opportunityTruth';
import { UsaJobsConnector } from '../usajobs';
import { feedOrganizationSlug } from '../ingestionRunner';

/**
 * A row copied off a public feed must never be described as though an employer
 * told VitalCV anything.
 *
 * These are the guarantees the whole ingestion wave rests on. If one of them
 * regresses, the public board starts publishing VitalCV's own inferences under
 * employer-stated language, which is the precise failure mode the truth
 * contract exists to prevent.
 */
function makeFeedRecord(): OpportunityTruthRecord {
  return {
    id: 'opp-feed-1',
    organizationId: 'org-feed-1',
    title: 'Physician (Internal Medicine)',
    specialty: 'Medical Officer',
    hiringType: 'perm',
    state: 'CA',
    payRange: null,
    payMin: 250000,
    payMax: 320000,
    requirementLevel: 'L1',
    description: 'Inpatient internal medicine at the VA Palo Alto campus.',
    remote: false,
    status: 'ACTIVE',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    listingSource: 'public_feed',
    sourceFeed: 'usajobs',
    sourceRef: 'VA-2026-11482',
    sourceUrl: 'https://www.usajobs.gov/job/11482',
    fetchedAt: new Date('2026-08-02T00:00:00.000Z'),
    organization: {
      name: 'Veterans Health Administration',
      slug: 'feed-usajobs-veterans-health-administration',
      // The defining property of a feed listing: no employer profile exists,
      // because no employer claimed anything.
      organizationProfile: null,
    },
  };
}

function makeClinician(): ClinicianOpportunityProfile {
  return {
    npi: '1234567890',
    specialty: 'Internal Medicine',
    stateOfPractice: 'CA',
    states: ['CA'],
    workAuthStatus: 'authorized',
    credentials: [
      { key: 'npi', level: 'L3', status: 'active', state: null, specialty: null, source: 'CMS NPPES' },
      { key: 'state_license', level: 'L3', status: 'active', state: 'CA', specialty: 'Internal Medicine', source: 'State board' },
    ],
  };
}

describe('feed listings never borrow employer-stated language', () => {
  const now = new Date('2026-08-02T12:00:00.000Z');

  it('publishes NO credential requirements', () => {
    // buildFallbackRequirements() would otherwise invent NPI + "CA Medical
    // License" + sanctions-clear from the state and requirement level, and the
    // board renders that list under the words "Employer requires".
    const truth = buildOpportunityTruth({ opportunity: makeFeedRecord(), now });
    expect(truth.credentialRequirements).toEqual([]);
  });

  it('still publishes requirements for an employer-posted row', () => {
    // Proves the suppression is scoped to the feed case and has not simply
    // disabled requirements everywhere.
    const record = { ...makeFeedRecord(), listingSource: 'employer_posted', sourceFeed: null };
    const truth = buildOpportunityTruth({ opportunity: record, now });
    expect(truth.credentialRequirements.length).toBeGreaterThan(0);
  });

  it('names the feed as the source, and links back to the posting', () => {
    const truth = buildOpportunityTruth({ opportunity: makeFeedRecord(), now });
    expect(truth.source.kind).toBe('public_feed');
    expect(truth.source.label).toBe('Listed on USAJOBS');
    expect(truth.source.url).toBe('https://www.usajobs.gov/job/11482');
    expect(truth.source.fetchedAt).toBe('2026-08-02T00:00:00.000Z');
    expect(truth.isFeedListing).toBe(true);
    expect(truth.applicationMode).toBe('external');
    expect(truth.availability).toMatchObject({
      state: 'open',
      confidence: 'recent_observation',
      observedAt: '2026-08-02T00:00:00.000Z',
    });
  });

  it('withholds the readiness comparison even for a fully credentialed clinician', () => {
    // A comparison answers "do you meet THIS employer's requirements". With no
    // stated requirements, any verdict — including a flattering "Ready now" —
    // would be measured against requirements VitalCV made up.
    const truth = buildOpportunityTruth({
      opportunity: makeFeedRecord(),
      clinicianProfile: makeClinician(),
      now,
    });
    expect(truth.comparison).toBeNull();
  });

  it('produces a comparison for the same clinician on an employer-posted row', () => {
    const record = { ...makeFeedRecord(), listingSource: 'employer_posted', sourceFeed: null };
    const truth = buildOpportunityTruth({
      opportunity: record,
      clinicianProfile: makeClinician(),
      now,
    });
    expect(truth.comparison).not.toBeNull();
  });

  it('never carries a verified-employer trust indicator', () => {
    const truth = buildOpportunityTruth({ opportunity: makeFeedRecord(), now });
    const indicators = truth.trustIndicators.join(' ').toLowerCase();
    expect(indicators).not.toContain('verified');
  });

  it('keeps the structured pay the feed actually published', () => {
    // Suppressing employer CLAIMS must not suppress facts the feed stated.
    const truth = buildOpportunityTruth({ opportunity: makeFeedRecord(), now });
    expect(truth.payRangeMin).toBe(250000);
    expect(truth.payRangeMax).toBe(320000);
    expect(truth.compensationProvenance).toMatchObject({
      state: 'supplied',
      method: 'structured_source',
      sourceLabel: 'Listed on USAJOBS',
    });
  });

  it('states missing compensation rather than parsing an unstructured mention', () => {
    const truth = buildOpportunityTruth({
      opportunity: {
        ...makeFeedRecord(),
        payMin: null,
        payMax: null,
        description: 'The listing prose mentions $39/hour but publishes no structured pay field.',
      },
      now,
    });

    expect(truth.payRangeMin).toBeNull();
    expect(truth.payRangeMax).toBeNull();
    expect(truth.compensationProvenance.state).toBe('not_supplied');
  });

  it('never borrows facts from a profile attached to the feed placeholder organization', () => {
    const truth = buildOpportunityTruth({
      opportunity: {
        ...makeFeedRecord(),
        payMin: null,
        payMax: null,
        organization: {
          ...makeFeedRecord().organization,
          organizationProfile: {
            facilityType: 'hospital',
            hiringStatus: 'ACTIVELY_HIRING',
            timeToStart: '7 days',
            timeToOnboard: '3 days',
            clearToStartThreshold: 'Internal policy',
            payTransparency: true,
            payRange: '$999/hour',
            description: 'Benefits include housing and malpractice coverage.',
            tagline: 'Employer-managed profile',
            requirements: [],
            verifiedSince: new Date('2026-08-01T00:00:00.000Z'),
            verified: true,
            updatedAt: new Date('2026-08-01T00:00:00.000Z'),
          },
        },
      },
      now,
    });

    expect(truth.payRange).toBeNull();
    expect(truth.compensationProvenance.state).toBe('not_supplied');
    expect(truth.benefitsAvailability).toBe('not_listed');
    expect(truth.startTimeline).toBeNull();
    expect(truth.trustIndicators.join(' ')).not.toMatch(/profile|benefit|start/i);
  });
});

describe('feed employers cannot occupy a real employer’s slug', () => {
  it('namespaces the slug by feed', () => {
    const slug = feedOrganizationSlug('usajobs', 'Veterans Health Administration');
    expect(slug).toBe('feed-usajobs-veterans-health-administration');
    expect(slug.startsWith('feed-')).toBe(true);
  });
});

describe('an unconfigured connector is skipped, never silently empty', () => {
  const saved = { key: process.env.USAJOBS_API_KEY, agent: process.env.USAJOBS_USER_AGENT };

  afterEach(() => {
    process.env.USAJOBS_API_KEY = saved.key;
    process.env.USAJOBS_USER_AGENT = saved.agent;
  });

  it('reports unconfigured and names the missing variables', () => {
    delete process.env.USAJOBS_API_KEY;
    delete process.env.USAJOBS_USER_AGENT;

    const connector = new UsaJobsConnector();
    expect(connector.isConfigured()).toBe(false);
    expect(connector.configurationHint()).toContain('USAJOBS_API_KEY');
    expect(connector.configurationHint()).toContain('USAJOBS_USER_AGENT');
  });

  it('throws rather than returning [] when asked to fetch unconfigured', async () => {
    // An empty array would be indistinguishable from "the feed had no jobs",
    // which is how a dead integration goes unnoticed for weeks.
    delete process.env.USAJOBS_API_KEY;
    delete process.env.USAJOBS_USER_AGENT;

    await expect(new UsaJobsConnector().fetch({ limit: 10 })).rejects.toThrow(/not configured/i);
  });

  it('is configured once both variables are set', () => {
    process.env.USAJOBS_API_KEY = 'test-key';
    process.env.USAJOBS_USER_AGENT = 'ops@example.com';
    expect(new UsaJobsConnector().isConfigured()).toBe(true);
  });
});
