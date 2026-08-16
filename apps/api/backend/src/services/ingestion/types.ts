/**
 * Job-feed ingestion — shared shapes.
 *
 * A connector's only job is to turn one feed's payload into `FeedListing`s. It
 * does not touch the database, and it does not decide whether a listing is
 * worth keeping — the runner owns persistence and the relevance gate, so every
 * feed gets the same treatment and a new connector cannot quietly invent its
 * own rules.
 *
 * Everything here describes what a PUBLIC FEED SAID. Nothing in this file may
 * be presented as something an employer told VitalCV.
 */

/**
 * What `Opportunity.specialty` holds when a feed published none.
 *
 * `Opportunity.specialty` is non-nullable, so a feed listing without a stated
 * specialty needs a placeholder. It is a RECORD OF SILENCE, never a
 * requirement — an employer with no relationship to VitalCV has said nothing
 * about who they want. Anything reading this value must treat it as "not
 * stated" rather than comparing against it.
 */
export const SPECIALTY_NOT_STATED = 'Not stated';

/** True when the opportunity's specialty is the placeholder, not a real one. */
export function isSpecialtyStated(specialty: string | null | undefined): boolean {
  const value = specialty?.trim();
  return Boolean(value) && value !== SPECIALTY_NOT_STATED;
}

export interface FeedListing {
  /** The feed's own identifier. With `feed`, this is the idempotency key. */
  sourceRef: string;
  /** The original posting. Feed listings are applied to THERE, not here. */
  sourceUrl: string;
  title: string;
  /** Employer name exactly as the feed gives it — not an org that claimed us. */
  organizationName: string;
  /** Two-letter state, or null when the posting is not tied to one. */
  state: string | null;
  remote: boolean;
  description: string | null;
  /**
   * Specialty, only when the feed states one. NEVER guessed from a job title —
   * a wrong specialty puts a role in front of the wrong clinician.
   */
  specialty: string | null;
  /**
   * The profession the employer stated, already mapped to the API's vocabulary.
   * Null when the feed said nothing OR named more than one — a single-valued
   * facet cannot represent "open to either", and picking one of the two would
   * hide the role from half the clinicians eligible for it.
   */
  profession: string | null;
  /** Structured pay, only when the feed publishes real numbers. */
  payMin: number | null;
  payMax: number | null;
  /** When the FEED last changed the posting. Not a verification time. */
  postedAt: Date | null;
}

export interface FeedFetchResult {
  listings: FeedListing[];
  /**
   * True ONLY when these listings are the complete current set for the feed.
   *
   * This gates expiry, and getting it wrong destroys live inventory: expiry
   * closes rows the run did not see, so reporting `complete` after fetching
   * page one of a five-thousand-job feed would close every listing on pages
   * two onward. A connector that cannot prove it saw everything must report
   * false — the cost is listings lingering slightly longer, which is by far
   * the cheaper mistake.
   */
  complete: boolean;
}

export interface FeedConnector {
  /** Stable key, stored in Opportunity.sourceFeed. */
  readonly feed: string;
  /**
   * Whether this connector can run right now. A connector needing a credential
   * that is unset must report false rather than throwing or, worse, returning
   * an empty page that reads like "the feed has no jobs".
   */
  isConfigured(): boolean;
  /** Human-readable reason it cannot run, for the operator report. */
  configurationHint(): string;
  /**
   * Per-run ceiling for THIS feed, when the default is too low to ever see it
   * whole. Optional; the runner's default applies when absent.
   *
   * This exists because the ceiling and `complete` interact: a feed larger
   * than its ceiling must truncate, truncation means the run did not see
   * everything, and `complete: false` blocks expiry — permanently. A feed
   * bounded by something real (an explicit roster, not a page count) can raise
   * its own ceiling above that bound so a run can conclude.
   */
  readonly maxListings?: number;
  fetch(options: { limit: number }): Promise<FeedFetchResult>;
}

export interface IngestionReport {
  feed: string;
  /** False when the connector was skipped for want of configuration. */
  ran: boolean;
  skippedReason: string | null;
  fetched: number;
  /** Listings rejected by the relevance gate. */
  rejectedNotClinical: number;
  /** Listings rejected because the feed omitted something required. */
  rejectedIncomplete: number;
  created: number;
  updated: number;
  /** Rows closed because the feed no longer lists them. */
  expired: number;
  /**
   * Why expiry did not run. Non-null whenever `expired` is 0 for a reason other
   * than "nothing was stale" — an operator must be able to tell a clean sweep
   * from a sweep that was not allowed to conclude anything.
   */
  expirySkippedReason: string | null;
  errors: string[];
}
