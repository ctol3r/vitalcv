/**
 * sitemapSeed.ts — which provider pages VitalCV asks crawlers to fetch.
 *
 * /directory/[npi] answers for any NPI in the federal registry. The sitemap is
 * deliberately a small, declared subset of that: the beachhead specialties in
 * ten states, chosen from a federal enrolment file rather than enumerated.
 * See scripts/build-directory-sitemap-seed.ts for how the seed is produced.
 *
 * The page exists whether or not it is in the sitemap — NPPES is public record
 * and the route is open — so this file governs discovery speed, not exposure.
 * The exclusion list below is the part that governs exposure, and it is applied
 * here, at read time, so regenerating the seed cannot resurrect anyone.
 */

import seed from './sitemap-seed.json';

/**
 * Clinicians who asked not to be listed.
 *
 * Applied after the seed loads, so it outlives any regeneration of
 * sitemap-seed.json. Removing an NPI from the sitemap stops VitalCV pointing
 * crawlers at the page; it does not remove the page, because the underlying
 * CMS filing is public record and /directory/[npi] renders it on request.
 *
 * Add the NPI and the date. Nothing else — a reason field here would build a
 * small database of who objected and why, which is not ours to keep.
 */
export const EXCLUDED_NPIS: ReadonlySet<string> = new Set([
  // '1234567890', // 2026-08-10
]);

export interface DirectorySeedProvenance {
  name: string;
  dataset: string;
  endpoint: string;
  retrievedAt: string;
}

/**
 * Valid, de-duplicated, excluded-list applied, sorted.
 *
 * Exported separately from the seed it normally reads so the filtering can be
 * exercised with an exclusion list that is not empty. A test that could only
 * call directorySitemapNpis() would assert that today's empty EXCLUDED_NPIS
 * excludes nobody, which is true of any implementation including one that
 * ignores the list entirely.
 */
export function filterSeedNpis(
  raw: readonly unknown[],
  excluded: ReadonlySet<string>,
): string[] {
  const clean = new Set<string>();

  for (const npi of raw) {
    // A malformed entry would render a URL that 404s. A sitemap full of 404s
    // is worse than a short sitemap: it is a claim about pages that do not
    // exist, made directly to the crawler.
    if (typeof npi === 'string' && /^\d{10}$/.test(npi) && !excluded.has(npi)) {
      clean.add(npi);
    }
  }

  return [...clean].sort();
}

export function directorySitemapNpis(): string[] {
  return filterSeedNpis(Array.isArray(seed.npis) ? seed.npis : [], EXCLUDED_NPIS);
}

export function directorySeedProvenance(): DirectorySeedProvenance {
  return seed.source;
}

/**
 * 5,000 keeps each file far under the 50,000-URL / 50MB sitemap limits and
 * keeps a single chunk small enough to read by hand when something looks wrong.
 */
export const SITEMAP_CHUNK_SIZE = 5_000;

export function directorySitemapChunkCount(): number {
  return Math.max(1, Math.ceil(directorySitemapNpis().length / SITEMAP_CHUNK_SIZE));
}

export function directorySitemapChunk(id: number): string[] {
  const all = directorySitemapNpis();
  const start = id * SITEMAP_CHUNK_SIZE;
  return all.slice(start, start + SITEMAP_CHUNK_SIZE);
}
