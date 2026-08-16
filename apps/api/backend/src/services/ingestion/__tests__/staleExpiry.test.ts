/**
 * Stale-listing expiry closes rows the feed no longer carries. It is the one
 * destructive operation in the ingestion path, so each condition that must hold
 * before it may run is pinned here — including, for every guard, a case proving
 * the guard actually blocks rather than merely being present.
 *
 * The dangerous failure is silent: expiry that runs when it should not closes
 * live inventory, and a closed row simply vanishes from the board.
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

const listing: FeedListing = {
  sourceRef: 'VA-1',
  sourceUrl: 'https://www.usajobs.gov/job/1',
  title: 'Physician (Internal Medicine)',
  organizationName: 'Veterans Health Administration',
  state: 'CA',
  remote: false,
  description: 'Inpatient internal medicine.',
  specialty: 'Medical Officer',
  profession: null,
  payMin: 250000,
  payMax: 320000,
  postedAt: new Date('2026-07-28T00:00:00Z'),
};

class StubConnector implements FeedConnector {
  readonly feed = 'usajobs';
  constructor(private result: FeedFetchResult | Error) {}
  isConfigured() { return true; }
  configurationHint() { return ''; }
  async fetch(): Promise<FeedFetchResult> {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  findUnique.mockResolvedValue({ id: 'org-1' });
  create.mockResolvedValue({ id: 'org-1' });
  // A created row: createdAt === updatedAt.
  const now = new Date('2026-08-02T00:00:00Z');
  upsert.mockResolvedValue({ createdAt: now, updatedAt: now });
  updateMany.mockResolvedValue({ count: 3 });
});

describe('expiry runs only after a complete, clean, non-empty sweep', () => {
  it('closes unseen listings after a complete sweep', async () => {
    const report = await ingestFeed(new StubConnector({ listings: [listing], complete: true }));

    expect(report.expired).toBe(3);
    expect(report.expirySkippedReason).toBeNull();
    expect(updateMany).toHaveBeenCalledTimes(1);

    const where = updateMany.mock.calls[0][0].where;
    // Scoped to this feed's own ingested rows, and only ones not touched by
    // this run. An employer-posted row must never be reachable from here.
    expect(where.sourceFeed).toBe('usajobs');
    expect(where.listingSource).toBe('public_feed');
    expect(where.status).toBe('ACTIVE');
    expect(where.fetchedAt.lt).toBeInstanceOf(Date);
    expect(updateMany.mock.calls[0][0].data).toEqual({ status: 'CLOSED' });
  });

  it('does NOT expire after a partial sweep', async () => {
    // The sharp edge: after page one of a large feed, "unseen" means "not on
    // page one", and expiring on that basis closes everything further in.
    const report = await ingestFeed(new StubConnector({ listings: [listing], complete: false }));

    expect(updateMany).not.toHaveBeenCalled();
    expect(report.expired).toBe(0);
    expect(report.expirySkippedReason).toMatch(/partial/i);
  });

  it('does NOT expire when any listing failed to persist', async () => {
    // A failed write leaves a live listing with an old fetchedAt, which is
    // indistinguishable from a withdrawn one.
    upsert.mockRejectedValueOnce(new Error('write failed'));

    const report = await ingestFeed(new StubConnector({ listings: [listing], complete: true }));

    expect(report.errors.length).toBeGreaterThan(0);
    expect(updateMany).not.toHaveBeenCalled();
    expect(report.expirySkippedReason).toMatch(/errors/i);
  });

  it('does NOT expire when a complete sweep persisted nothing', async () => {
    // An empty complete sweep is far more often a broken query than an employer
    // withdrawing every vacancy at once — and acting on it closes the feed.
    const report = await ingestFeed(new StubConnector({ listings: [], complete: true }));

    expect(updateMany).not.toHaveBeenCalled();
    expect(report.expired).toBe(0);
    expect(report.expirySkippedReason).toMatch(/no listings|broken query/i);
  });

  it('does NOT expire when the fetch itself threw', async () => {
    const report = await ingestFeed(new StubConnector(new Error('HTTP 500')));

    expect(updateMany).not.toHaveBeenCalled();
    expect(report.expired).toBe(0);
    expect(report.errors[0]).toContain('HTTP 500');
  });

  it('does NOT expire when the connector is unconfigured', async () => {
    class Unconfigured extends StubConnector {
      isConfigured() { return false; }
      configurationHint() { return 'Set USAJOBS_API_KEY.'; }
    }
    const report = await ingestFeed(new Unconfigured({ listings: [], complete: true }));

    expect(report.ran).toBe(false);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('closes rather than deletes, so applications keep their referent', async () => {
    await ingestFeed(new StubConnector({ listings: [listing], complete: true }));
    expect(updateMany.mock.calls[0][0].data.status).toBe('CLOSED');
  });
});
