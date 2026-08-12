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
 * sitemap-seed.json.
 *
 * TWO EFFECTS, and both are needed for the request to mean anything. Dropping
 * an NPI from the sitemap only stops VitalCV *advertising* the page; a crawler
 * that already knows the URL keeps it. So `isExcludedFromDirectory` also drives
 * `robots: noindex` on that record's own page — see
 * app/directory/[npi]/page.tsx. Honouring half of this would let the product
 * tell someone they had been removed while their page stayed in the index.
 *
 * What it does NOT do, and the page says so: it cannot remove or change the CMS
 * filing. That is held by CMS, published at npiregistry.cms.hhs.gov, and
 * /directory/[npi] still renders it to anyone who asks for the URL directly.
 *
 * Add the NPI and the date. Nothing else — a reason field would build a small
 * database of who objected and why, which is not ours to keep.
 */
export const EXCLUDED_NPIS: ReadonlySet<string> = new Set([
  // '1234567890', // 2026-08-10
]);

/** True when this clinician asked not to be listed. */
export function isExcludedFromDirectory(npi: string): boolean {
  return EXCLUDED_NPIS.has(npi);
}

export interface DirectorySeedProvenance {
  name: string;
  dataset: string;
  endpoint: string;
  retrievedAt: string;
}

/**
 * Is VitalCV allowed to advertise provider pages to search engines?
 *
 * OFF until someone decides. #1329 named the question and declined to answer it
 * in a code review — "whether VitalCV should show the public record for someone
 * who never enrolled is a consent decision, not a copy fix" — and a sitemap
 * pointing crawlers at ~5,000 clinicians who have never heard of VitalCV is
 * that decision, made by merge.
 *
 * So it is staged the way this repo stages its other consequential switches
 * (CLERK_JWT_VERIFICATION, VERIFIER_RBAC_MODE): the code ships complete and
 * inert, and a founder flips one Railway variable. Off, the route still exists
 * and still answers — it advertises nothing, and robots.txt does not list it.
 *
 * Read per request, never frozen into the bundle, for the same reason
 * app/robots.ts is force-dynamic: a build-time read bakes whatever the CI
 * environment happened to have.
 */
export function directorySitemapEnabled(): boolean {
  return process.env.DIRECTORY_SITEMAP === 'enabled';
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
  if (!directorySitemapEnabled()) return [];
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
