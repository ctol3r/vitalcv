import type { MetadataRoute } from 'next';

// A single honest release date. The prior sitemap stamped `new Date()` on every
// entry, mislabeling every page as "modified today" on every crawl (spammy and
// untrue), and listed routes that 404 (/explore, /developers, /compliance,
// /updates, /about), a robots-disallowed route (/review), and a named
// health-system page that implied a partnership. Only real, public, polished
// routes are listed here.
const RELEASE = new Date('2026-07-15T00:00:00Z');
const OPPORTUNITY_BOARD_RELEASE = new Date('2026-07-29T00:00:00Z');

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://vitalcv.com', lastModified: RELEASE, changeFrequency: 'weekly', priority: 1 },
    { url: 'https://vitalcv.com/explore', lastModified: OPPORTUNITY_BOARD_RELEASE, changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://vitalcv.com/onboarding', lastModified: RELEASE, changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://vitalcv.com/passport', lastModified: RELEASE, changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://vitalcv.com/employers', lastModified: RELEASE, changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://vitalcv.com/solutions', lastModified: RELEASE, changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://vitalcv.com/pilot', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://vitalcv.com/trust', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://vitalcv.com/pricing', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://vitalcv.com/contact', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://vitalcv.com/for/cvo', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://vitalcv.com/for/payer', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://vitalcv.com/for/staffing-exchange', lastModified: RELEASE, changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://vitalcv.com/status', lastModified: RELEASE, changeFrequency: 'daily', priority: 0.4 },
  ];
}
