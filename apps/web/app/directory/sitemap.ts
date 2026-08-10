/**
 * /directory/sitemap/[id].xml — the provider pages VitalCV asks to have crawled.
 *
 * Separate from app/sitemap.ts on purpose. That file is 22 hand-maintained
 * marketing and legal routes whose lastModified is recomputed from git and
 * guarded in both directions by sitemap-freshness.test.ts. This one is
 * thousands of generated URLs from a federal enrolment file. Merging them would
 * put a data-derived section inside a test that measures the repository, and
 * the freshness guard would start failing for a reason unrelated to freshness.
 *
 * NO lastModified, changeFrequency, OR priority
 * --------------------------------------------
 * All three are optional, and all three would be invented here. VitalCV does
 * not know when a given clinician last updated their NPPES filing without
 * fetching that clinician's record, and fetching ~5,000 records to build a
 * sitemap would make crawling depend on CMS being up. `new Date()` is the
 * fabrication app/sitemap.ts was rewritten to remove; the honest move is to
 * omit the field rather than stamp it with the build time and let a crawler
 * read that as "this clinician's record changed today".
 */

import type { MetadataRoute } from 'next';
import {
  directorySitemapChunk,
  directorySitemapChunkCount,
} from '@/lib/directory/sitemapSeed';

const BASE = 'https://vitalcv.com';

export async function generateSitemaps() {
  return Array.from({ length: directorySitemapChunkCount() }, (_, id) => ({ id }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  return directorySitemapChunk(id).map((npi) => ({
    url: `${BASE}/directory/${npi}`,
  }));
}
