/**
 * directory-sitemap.test.ts — the crawl request VitalCV actually makes.
 *
 * A sitemap is a set of assertions to a search engine: these URLs exist, and
 * (optionally) this is when they last changed. Both halves can be wrong in ways
 * nothing else in the stack notices — a malformed NPI produces a URL that 404s,
 * and a build-time `new Date()` tells a crawler that thousands of clinicians
 * updated their federal filing at the moment of deploy.
 *
 * app/sitemap.ts already guards the hand-maintained half against exactly that
 * second failure. This guards the generated half.
 */

import { describe, it, expect } from 'vitest';
import {
  directorySitemapNpis,
  directorySitemapChunk,
  directorySitemapChunkCount,
  directorySeedProvenance,
  filterSeedNpis,
  SITEMAP_CHUNK_SIZE,
} from '@/lib/directory/sitemapSeed';
import directorySitemap, { generateSitemaps } from '@/app/directory/sitemap';
import robots from '@/app/robots';

describe('seed integrity', () => {
  it('lists only well-formed NPIs', () => {
    const bad = directorySitemapNpis().filter((npi) => !/^\d{10}$/.test(npi));
    expect(bad).toEqual([]);
  });

  it('lists each NPI once', () => {
    const all = directorySitemapNpis();
    expect(new Set(all).size).toBe(all.length);
  });

  it('is not empty', () => {
    // A silently-empty seed would advertise a sitemap containing nothing, which
    // reads to a crawler as "this section has no pages".
    expect(directorySitemapNpis().length).toBeGreaterThan(0);
  });

  it('records where the seed came from and when', () => {
    const p = directorySeedProvenance();
    expect(p.dataset).toBe('mj5m-pzi6');
    expect(p.endpoint).toContain('data.cms.gov');
    expect(Number.isNaN(Date.parse(p.retrievedAt))).toBe(false);
  });
});

describe('opt-out', () => {
  it('drops an excluded NPI', () => {
    const raw = ['1558395516', '1558395511'];

    const kept = filterSeedNpis(raw, new Set(['1558395511']));

    expect(kept).toEqual(['1558395516']);
  });

  it('drops malformed entries rather than emitting a URL that 404s', () => {
    const raw = ['1558395516', '123', '', 'abcdefghij', null, 12345, '15583955160'];

    expect(filterSeedNpis(raw, new Set())).toEqual(['1558395516']);
  });
});

describe('chunking', () => {
  it('covers every NPI exactly once across chunks', () => {
    const chunks = Array.from({ length: directorySitemapChunkCount() }, (_, id) =>
      directorySitemapChunk(id),
    );
    const flat = chunks.flat();

    expect(flat.sort()).toEqual(directorySitemapNpis());
    expect(new Set(flat).size).toBe(flat.length);
  });

  it('keeps every chunk inside the sitemap size limit', () => {
    for (let id = 0; id < directorySitemapChunkCount(); id += 1) {
      expect(directorySitemapChunk(id).length).toBeLessThanOrEqual(SITEMAP_CHUNK_SIZE);
    }
    expect(SITEMAP_CHUNK_SIZE).toBeLessThanOrEqual(50_000);
  });

  it('announces one sitemap per chunk', async () => {
    expect(await generateSitemaps()).toHaveLength(directorySitemapChunkCount());
  });
});

describe('emitted entries', () => {
  it('points at absolute /directory URLs', async () => {
    const entries = await directorySitemap({ id: 0 });

    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries.slice(0, 50)) {
      expect(entry.url).toMatch(/^https:\/\/vitalcv\.com\/directory\/\d{10}$/);
    }
  });

  it('claims no date it cannot measure', async () => {
    // VitalCV does not know when a clinician last changed their NPPES filing
    // without fetching that record. Stamping the build time here would tell a
    // crawler that all ~5,000 of them changed at deploy.
    const entries = await directorySitemap({ id: 0 });

    for (const entry of entries.slice(0, 50)) {
      expect(entry.lastModified).toBeUndefined();
      expect(entry.changeFrequency).toBeUndefined();
      expect(entry.priority).toBeUndefined();
    }
  });
});

describe('robots.txt advertises it', () => {
  const asList = (s: string | string[] | undefined) =>
    s === undefined ? [] : Array.isArray(s) ? s : [s];

  it('lists the hand-maintained sitemap and every directory chunk', () => {
    const previous = process.env.RAILWAY_ENVIRONMENT;
    process.env.RAILWAY_ENVIRONMENT = 'production';
    try {
      const sitemaps = asList(robots().sitemap);

      expect(sitemaps).toContain('https://vitalcv.com/sitemap.xml');
      for (let id = 0; id < directorySitemapChunkCount(); id += 1) {
        expect(sitemaps).toContain(`https://vitalcv.com/directory/sitemap/${id}.xml`);
      }
    } finally {
      if (previous === undefined) delete process.env.RAILWAY_ENVIRONMENT;
      else process.env.RAILWAY_ENVIRONMENT = previous;
    }
  });

  it('advertises nothing off canonical production', () => {
    // The review environment runs the identical production build, so a sitemap
    // served from it would invite a crawler to reconcile two origins.
    const previous = process.env.RAILWAY_ENVIRONMENT;
    process.env.RAILWAY_ENVIRONMENT = 'review';
    try {
      expect(asList(robots().sitemap)).toEqual([]);
    } finally {
      if (previous === undefined) delete process.env.RAILWAY_ENVIRONMENT;
      else process.env.RAILWAY_ENVIRONMENT = previous;
    }
  });

  it('does not disallow the directory tree it just advertised', () => {
    const previous = process.env.RAILWAY_ENVIRONMENT;
    process.env.RAILWAY_ENVIRONMENT = 'production';
    try {
      const rules = robots().rules;
      const disallow = (Array.isArray(rules) ? rules : [rules]).flatMap((r) =>
        r?.disallow === undefined ? [] : Array.isArray(r.disallow) ? r.disallow : [r.disallow],
      );

      expect(disallow.some((path) => path.startsWith('/directory'))).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.RAILWAY_ENVIRONMENT;
      else process.env.RAILWAY_ENVIRONMENT = previous;
    }
  });
});
