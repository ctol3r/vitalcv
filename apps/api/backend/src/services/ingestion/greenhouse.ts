/**
 * Greenhouse public job boards connector.
 *
 * `boards-api.greenhouse.io` is the endpoint an employer's own careers page
 * calls to render its listings — public by design, no credential, and intended
 * for syndication. This connector reads exactly what that endpoint returns.
 * It is not a crawler: it never fetches a careers page, never follows a link,
 * and never reads anything an employer did not publish as their job board.
 *
 * Nothing here is an employer's statement TO VitalCV. These employers have no
 * relationship with VitalCV, have not claimed an NPI, and have said nothing
 * about their requirements. The runner stamps `listingSource='public_feed'`
 * and creates their Organization without a profile, so no part of the read
 * path can dress a copied listing as employer-backed — and `sourceUrl` sends
 * every application back to the employer's own posting.
 *
 * There is no board directory or search API: a board is only reachable if you
 * already know its token. So the roster below is explicit and was validated
 * against the live endpoint rather than guessed — see BOARDS.
 */

import { STATE_CODES, STATE_NAME_TO_CODE } from './usStates';
import type { FeedConnector, FeedFetchResult, FeedListing } from './types';

const BOARDS_API = 'https://boards-api.greenhouse.io/v1/boards';

/**
 * The employer roster.
 *
 * Every token was probed against the live endpoint and kept only if it
 * returned jobs including roles a licensed clinician holds. Boards that
 * answered with zero jobs, or with none clinical, are not listed — carrying
 * them would spend a request per cycle to import nothing.
 *
 * Adding an employer is a deliberate act: probe the token, confirm clinical
 * roles, add it here. It is not a crawl and must not become one.
 */
export const BOARDS: readonly string[] = [
  'onemedical',
  'twochairs',
  'charliehealth',
  'hazel',
  'firsthand',
  'midihealth',
  'ophelia',
  'parsleyhealth',
  'oshihealth',
  'valerahealth',
  'galileo',
  'cerebral',
];

interface GreenhouseJob {
  id?: number | string;
  title?: string;
  absolute_url?: string;
  updated_at?: string;
  location?: { name?: string } | null;
  content?: string;
}

/**
 * Two-letter state, or null.
 *
 * Greenhouse locations are free text an employer typed — "New York, NY",
 * "Remote, USA", "California", "Multiple Locations". Only a confidently
 * recognised state is returned; anything else is null, and the runner's
 * `isPersistable` then drops the listing rather than placing a role in a state
 * it was never stated to be in.
 */
export function extractState(locationName: string | undefined | null): string | null {
  const raw = locationName?.trim();
  if (!raw) return null;

  // Try each comma-separated part from the right: "New York, NY" → "NY".
  const parts = raw.split(',').map((p) => p.trim()).filter(Boolean).reverse();
  for (const part of parts) {
    const upper = part.toUpperCase();
    if (upper.length === 2 && STATE_CODES.has(upper)) {
      return upper;
    }
    const named = STATE_NAME_TO_CODE[part.toLowerCase()];
    if (named) return named;
  }
  return null;
}

/**
 * Whether the posting states it is remote.
 *
 * Claiming remote without the feed saying so would be an invention, so this
 * reads the location text only, and only for an explicit word.
 */
export function isRemote(locationName: string | undefined | null): boolean {
  return /\bremote\b|\bwork from home\b|\btelehealth\b/i.test(locationName ?? '');
}

/** Greenhouse `content` is HTML-escaped HTML. Plain text, or null. */
export function toPlainText(content: string | undefined): string | null {
  if (!content) return null;
  const text = content
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 0 ? text.slice(0, 4000) : null;
}

/** One board's payload → listings. Exported for testing without a network. */
export function normalizeBoardJobs(jobs: GreenhouseJob[], board: string): FeedListing[] {
  const listings: FeedListing[] = [];

  for (const job of jobs) {
    const id = job.id;
    const title = job.title?.trim();
    const url = job.absolute_url?.trim();
    if (id === undefined || id === null || !title || !url) continue;

    const locationName = job.location?.name ?? null;
    const posted = job.updated_at ? new Date(job.updated_at) : null;

    listings.push({
      // Namespaced by board: two employers' boards can both use job id 1.
      sourceRef: `${board}:${id}`,
      sourceUrl: url,
      title,
      organizationName: board,
      state: extractState(locationName),
      remote: isRemote(locationName),
      description: toPlainText(job.content),
      // Greenhouse publishes no specialty field. Inferring one from the title
      // would put a role in front of the wrong clinician (see FeedListing).
      specialty: null,
      // The public boards endpoint carries no structured compensation. A
      // number parsed out of prose would be a guess presented as a figure.
      payMin: null,
      payMax: null,
      postedAt: posted && !Number.isNaN(posted.getTime()) ? posted : null,
    });
  }

  return listings;
}

export class GreenhouseBoardsConnector implements FeedConnector {
  readonly feed = 'greenhouse';

  private readonly boards: readonly string[];

  constructor(boards: readonly string[] = BOARDS) {
    this.boards = boards;
  }

  /** No credential exists to be missing — the endpoint is public. */
  isConfigured(): boolean {
    return this.boards.length > 0;
  }

  configurationHint(): string {
    return this.boards.length === 0 ? 'No Greenhouse boards are configured.' : '';
  }

  async fetch({ limit }: { limit: number }): Promise<FeedFetchResult> {
    const listings: FeedListing[] = [];
    let allBoardsSucceeded = true;

    for (const board of this.boards) {
      if (listings.length >= limit) {
        // Stopped early, so this run has NOT seen the feed's full set.
        allBoardsSucceeded = false;
        break;
      }

      try {
        const response = await fetch(`${BOARDS_API}/${encodeURIComponent(board)}/jobs?content=true`, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(20_000),
        });

        if (!response.ok) {
          allBoardsSucceeded = false;
          continue;
        }

        const payload = (await response.json()) as { jobs?: GreenhouseJob[] };
        listings.push(...normalizeBoardJobs(payload.jobs ?? [], board));
      } catch {
        // One board failing must not let expiry close that board's live rows.
        allBoardsSucceeded = false;
      }
    }

    return {
      listings: listings.slice(0, limit),
      /*
       * `complete` gates expiry, which closes every row this run did not see.
       * It may only be true when every board answered: if one board 500s and
       * we still claimed completeness, expiry would close that entire
       * employer's live inventory on the strength of an outage.
       */
      complete: allBoardsSucceeded && listings.length <= limit,
    };
  }
}
