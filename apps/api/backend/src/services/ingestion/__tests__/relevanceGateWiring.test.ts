/**
 * The relevance gate must be WIRED, not merely present.
 *
 * `clinicalRelevance` has its own unit tests, and they all passed while the
 * runner did not call it — deleting the call from `ingestFeed` left the whole
 * ingestion suite green. A gate nothing invokes is decoration.
 *
 * So these cases drive the real `ingestFeed` and assert the OUTCOME: a
 * non-clinical listing is counted in `rejectedNotClinical` and never reaches
 * `upsert`. Removing the call from the runner turns them red.
 */

const updateMany = jest.fn();
const findUnique = jest.fn();
const create = jest.fn();
const upsert = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    opportunity: {
      updateMany: (...args: unknown[]) => updateMany(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
    organization: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      create: (...args: unknown[]) => create(...args),
    },
  },
}));

import { ingestFeed } from '../ingestionRunner';
import type { FeedConnector, FeedFetchResult, FeedListing } from '../types';

function listing(title: string, sourceRef: string): FeedListing {
  return {
    sourceRef,
    sourceUrl: `https://job-boards.greenhouse.io/acme/jobs/${sourceRef}`,
    title,
    organizationName: 'acme',
    state: 'CA',
    remote: false,
    description: null,
    specialty: null,
    profession: null,
    payMin: null,
    payMax: null,
    postedAt: null,
  };
}

class StubConnector implements FeedConnector {
  readonly feed = 'greenhouse';
  constructor(private readonly listings: FeedListing[]) {}
  isConfigured() { return true; }
  configurationHint() { return ''; }
  async fetch(): Promise<FeedFetchResult> {
    // complete:false so expiry stays out of the way — this is about the gate.
    return { listings: this.listings, complete: false };
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  findUnique.mockResolvedValue({ id: 'org-1' });
  upsert.mockResolvedValue({ createdAt: new Date(), updatedAt: new Date() });
});

describe('the runner applies the clinical relevance gate', () => {
  it('rejects a non-clinical listing and never persists it', async () => {
    const report = await ingestFeed(new StubConnector([
      listing('Senior Software Engineer', 'gh-1'),
    ]));

    expect(report.fetched).toBe(1);
    expect(report.rejectedNotClinical).toBe(1);
    expect(report.created).toBe(0);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('persists a clinical listing from the same feed', async () => {
    const report = await ingestFeed(new StubConnector([
      listing('Registered Nurse', 'gh-2'),
    ]));

    expect(report.rejectedNotClinical).toBe(0);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('separates the two in one mixed batch — the real public-board shape', async () => {
    // A health company's board is mostly non-clinical. Only the clinical rows
    // may reach the board a clinician reads.
    const report = await ingestFeed(new StubConnector([
      listing('Registered Nurse', 'gh-3'),
      listing('Staff Product Designer', 'gh-4'),
      listing('Nurse Practitioner - Primary Care', 'gh-5'),
      listing('Director of Clinical Operations', 'gh-6'),
      listing('Account Executive', 'gh-7'),
    ]));

    expect(report.fetched).toBe(5);
    expect(report.rejectedNotClinical).toBe(3);
    expect(upsert).toHaveBeenCalledTimes(2);

    const persistedTitles = upsert.mock.calls.map(
      ([args]) => (args as { create: { title: string } }).create.title,
    );
    expect(persistedTitles.sort()).toEqual([
      'Nurse Practitioner - Primary Care',
      'Registered Nurse',
    ]);
  });

  it('stamps every persisted feed row as public_feed with its source', async () => {
    await ingestFeed(new StubConnector([listing('Registered Nurse', 'gh-8')]));

    const [args] = upsert.mock.calls[0] as [{ create: Record<string, unknown> }];
    expect(args.create.listingSource).toBe('public_feed');
    expect(args.create.sourceFeed).toBe('greenhouse');
    expect(args.create.sourceRef).toBe('gh-8');
    expect(args.create.sourceUrl).toBe('https://job-boards.greenhouse.io/acme/jobs/gh-8');
    expect(args.create.fetchedAt).toBeInstanceOf(Date);
    // A feed said nothing about requirements, so the row sits at the floor.
    expect(args.create.requirementLevel).toBe('L1');
    // And no specialty was invented from the title.
    expect(args.create.specialty).toBe('Not stated');
  });
});
