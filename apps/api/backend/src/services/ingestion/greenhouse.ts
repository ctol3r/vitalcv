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

/**
 * Take from each board in turn until the budget is spent, so a large employer
 * cannot crowd out the rest. Exported for testing.
 */
export function roundRobin(
  perBoard: Map<string, FeedListing[]>,
  limit: number,
): FeedListing[] {
  const queues = [...perBoard.values()].map((list) => [...list]);
  const taken: FeedListing[] = [];
  let progressed = true;

  while (taken.length < limit && progressed) {
    progressed = false;
    for (const queue of queues) {
      if (taken.length >= limit) break;
      const next = queue.shift();
      if (next) {
        taken.push(next);
        progressed = true;
      }
    }
  }

  return taken;
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
    /*
     * Every board is read, then the limit is applied by taking a fair share of
     * each — never by truncating in roster order.
     *
     * The first version broke out of the loop once the running total reached
     * the limit. `onemedical` alone returns ~339 listings, so it filled the
     * budget on iteration one and the remaining eleven employers were never
     * fetched at all: production came up with 188 rows, all from one employer.
     * Ordering silently decided who existed.
     *
     * Reading all twelve is not an unbounded pull — the roster is explicit and
     * small, which is what bounds this feed. The limit then governs how many
     * rows are kept, and round-robin means a large employer cannot starve the
     * rest.
     */
    const perBoard = new Map<string, FeedListing[]>();
    let allBoardsSucceeded = true;

    for (const board of this.boards) {
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
        perBoard.set(board, normalizeBoardJobs(payload.jobs ?? [], board));
      } catch {
        // One board failing must not let expiry close that board's live rows.
        allBoardsSucceeded = false;
      }
    }

    const total = [...perBoard.values()].reduce((sum, list) => sum + list.length, 0);
    const listings = total <= limit
      ? [...perBoard.values()].flat()
      : roundRobin(perBoard, limit);

    return {
      listings,
      /*
       * `complete` gates expiry, which closes every row this run did not see.
       * True only when every board answered AND nothing was dropped to fit the
       * limit: if one board 500s, or a fair share left rows behind, expiry
       * would otherwise close live inventory on the strength of an outage or a
       * ceiling.
       */
      complete: allBoardsSucceeded && total <= limit,
    };
  }
}
