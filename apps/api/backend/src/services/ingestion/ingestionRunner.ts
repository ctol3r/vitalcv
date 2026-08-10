/**
 * Ingestion runner — turns FeedListings into Opportunity rows.
 *
 * Two rules govern everything here:
 *
 * 1. A feed listing never becomes a claimed employer. The Organization row it
 *    needs is created WITHOUT an OrganizationProfile, so the read path has no
 *    profile to draw verified/requirement/timeline claims from, and the row is
 *    stamped listingSource='public_feed'. Slugs are namespaced by feed so an
 *    ingested employer can never occupy the slug a real employer would claim.
 *
 * 2. Re-running is safe. (sourceFeed, sourceRef) is unique, so a second pass
 *    updates the row it created rather than duplicating the listing.
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { isClinicalRole } from './clinicalRelevance';
import { GreenhouseBoardsConnector } from './greenhouse';
import type { FeedConnector, FeedListing, IngestionReport } from './types';
import { UsaJobsConnector } from './usajobs';

export const FEED_CONNECTORS: FeedConnector[] = [
  new UsaJobsConnector(),
  new GreenhouseBoardsConnector(),
];

/** Default per-run ceiling, so one run cannot pull an unbounded page count. */
const DEFAULT_LIMIT = 200;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Feed employers live in their own slug namespace.
 *
 * Without the prefix an ingested "Veterans Health Administration" would sit on
 * the slug a real VA administrator would later claim, and claiming it would
 * silently adopt every ingested listing as employer-posted.
 */
export function feedOrganizationSlug(feed: string, organizationName: string): string {
  return `feed-${feed}-${slugify(organizationName)}`;
}

/**
 * A listing must name a state.
 *
 * Opportunity.state is NOT NULL and the board filters on it, and licensure is
 * per-state — a role with no state cannot be reasoned about by a clinician
 * whose licence is the whole question. Dropping is better than defaulting to
 * some placeholder that would read as a real location.
 */
function isPersistable(listing: FeedListing): boolean {
  return Boolean(listing.state && listing.title && listing.sourceUrl);
}

async function resolveFeedOrganizationId(feed: string, organizationName: string): Promise<string> {
  const slug = feedOrganizationSlug(feed, organizationName);

  const existing = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Deliberately no organizationProfile: there is nothing to put in one. The
  // absence is what keeps buildOpportunityTruth from asserting employer data.
  const created = await prisma.organization.create({
    data: { name: organizationName, slug },
    select: { id: true },
  });
  return created.id;
}

/**
 * Close listings the feed no longer carries.
 *
 * The mechanism is simple — any ACTIVE row for this feed whose `fetchedAt` is
 * older than the run start was not seen this time — and it is only SAFE under
 * conditions that must all hold:
 *
 *   1. The sweep was complete. After a partial page, "not seen" means "not on
 *      page one", and closing on that basis would wipe out every listing the
 *      page did not reach.
 *   2. Nothing errored. A failed upsert leaves a live listing with an old
 *      `fetchedAt`, indistinguishable from a withdrawn one.
 *   3. The feed returned something. An empty complete sweep is far more often a
 *      silently broken query than an employer withdrawing every vacancy at
 *      once, and treating it as truth would close the entire feed in one pass.
 *
 * Rows are CLOSED, never deleted: applications reference them, and a vacancy
 * that existed is a fact about the past.
 */
async function expireUnseenListings(
  feed: string,
  context: {
    runStartedAt: Date;
    sweepWasComplete: boolean;
    hadErrors: boolean;
    report: IngestionReport;
  },
): Promise<void> {
  const { runStartedAt, sweepWasComplete, hadErrors, report } = context;

  if (!sweepWasComplete) {
    report.expirySkippedReason =
      'Sweep was partial — cannot conclude an unseen listing was withdrawn.';
    return;
  }

  if (hadErrors) {
    report.expirySkippedReason =
      'Run had errors — a failed write looks identical to a withdrawn listing.';
    return;
  }

  if (report.created + report.updated === 0) {
    report.expirySkippedReason =
      'Sweep persisted no listings — treated as a broken query, not an empty feed.';
    return;
  }

  const result = await prisma.opportunity.updateMany({
    where: {
      sourceFeed: feed,
      listingSource: 'public_feed',
      status: 'ACTIVE',
      fetchedAt: { lt: runStartedAt },
    },
    data: { status: 'CLOSED' },
  });

  report.expired = result.count;

  if (result.count > 0) {
    log('info', 'ingestion expired withdrawn listings', {
      event: 'ingestion_expired',
      feed,
      expired: result.count,
    });
  }
}

export async function ingestFeed(
  connector: FeedConnector,
  options: { limit?: number } = {},
): Promise<IngestionReport> {
  // Stamped before the fetch. Rows touched by this run get fetchedAt >= this,
  // so anything still older afterwards is exactly what the feed no longer lists.
  const runStartedAt = new Date();

  const report: IngestionReport = {
    feed: connector.feed,
    ran: false,
    skippedReason: null,
    fetched: 0,
    rejectedNotClinical: 0,
    rejectedIncomplete: 0,
    created: 0,
    updated: 0,
    expired: 0,
    expirySkippedReason: null,
    errors: [],
  };

  if (!connector.isConfigured()) {
    // Reported, not thrown, and clearly distinct from "the feed had nothing".
    report.skippedReason = connector.configurationHint();
    log('info', 'ingestion feed skipped — not configured', {
      event: 'ingestion_skipped',
      feed: connector.feed,
      reason: report.skippedReason,
    });
    return report;
  }

  report.ran = true;

  let listings: FeedListing[];
  let sweepWasComplete = false;
  try {
    const result = await connector.fetch({
      // A connector bounded by an explicit roster may raise its own ceiling —
      // otherwise a feed bigger than DEFAULT_LIMIT truncates every run, never
      // reports complete, and its stale rows can never expire.
      limit: options.limit ?? connector.maxListings ?? DEFAULT_LIMIT,
    });
    listings = result.listings;
    sweepWasComplete = result.complete;
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    log('error', 'ingestion feed fetch failed', {
      event: 'ingestion_fetch_failed',
      feed: connector.feed,
      error: report.errors[0],
    });
    return report;
  }

  report.fetched = listings.length;

  for (const listing of listings) {
    if (!isPersistable(listing)) {
      report.rejectedIncomplete += 1;
      continue;
    }

    /*
     * The relevance gate `types.ts` always described, finally applied here so
     * every feed gets it. USAJOBS never needed it — it restricts to nine
     * clinical series server-side — so `rejectedNotClinical` was declared and
     * summed but never incremented. A feed without a server-side clinical
     * filter (any public ATS board) would otherwise have every listing
     * persisted, and the board would fill with engineers and recruiters.
     */
    if (!isClinicalRole(listing.title)) {
      report.rejectedNotClinical += 1;
      continue;
    }

    try {
      const organizationId = await resolveFeedOrganizationId(connector.feed, listing.organizationName);

      const data = {
        organizationId,
        title: listing.title,
        // The feed's own classification, or a neutral placeholder — never a
        // specialty inferred from the job title.
        specialty: listing.specialty ?? 'Not stated',
        hiringType: 'perm',
        state: listing.state as string,
        payRange: null,
        payMin: listing.payMin,
        payMax: listing.payMax,
        // Requirement level is an EMPLOYER's statement about their own bar.
        // A feed said nothing, so this stays at the floor and the read path
        // publishes no requirements for the row at all.
        requirementLevel: 'L1',
        description: listing.description,
        remote: listing.remote,
        status: 'ACTIVE',
        listingSource: 'public_feed',
        sourceFeed: connector.feed,
        sourceRef: listing.sourceRef,
        sourceUrl: listing.sourceUrl,
        fetchedAt: new Date(),
      };

      const result = await prisma.opportunity.upsert({
        where: {
          sourceFeed_sourceRef: {
            sourceFeed: connector.feed,
            sourceRef: listing.sourceRef,
          },
        },
        create: data,
        update: data,
        select: { createdAt: true, updatedAt: true },
      });

      // createdAt === updatedAt only on the insert.
      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        report.created += 1;
      } else {
        report.updated += 1;
      }
    } catch (error) {
      report.errors.push(
        `${listing.sourceRef}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  await expireUnseenListings(connector.feed, {
    runStartedAt,
    sweepWasComplete,
    hadErrors: report.errors.length > 0,
    report,
  });

  log('info', 'ingestion feed complete', {
    event: 'ingestion_complete',
    feed: connector.feed,
    fetched: report.fetched,
    created: report.created,
    updated: report.updated,
    rejected: report.rejectedIncomplete + report.rejectedNotClinical,
    errors: report.errors.length,
  });

  return report;
}

export async function ingestAllFeeds(options: { limit?: number } = {}): Promise<IngestionReport[]> {
  const reports: IngestionReport[] = [];
  for (const connector of FEED_CONNECTORS) {
    reports.push(await ingestFeed(connector, options));
  }
  return reports;
}
