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
  /** Structured pay, only when the feed publishes real numbers. */
  payMin: number | null;
  payMax: number | null;
  /** When the FEED last changed the posting. Not a verification time. */
  postedAt: Date | null;
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
  fetch(options: { limit: number }): Promise<FeedListing[]>;
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
  errors: string[];
}
