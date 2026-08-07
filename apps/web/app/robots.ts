import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // W0.4: `/demo` and `/design/` are demo/prototype surfaces. Both carry
        // noindex now, but robots.txt is the cheaper, coarser gate and it also
        // covers the sample-clinician surfaces /demo links into.
        disallow: [
          '/api/',
          '/internal/',
          '/review/',
          '/mission-ops/',
          '/pilot-ops/',
          '/holder/',
          '/workspace/',
          '/demo',
          '/design/',
        ],
      },
    ],
    sitemap: 'https://vitalcv.com/sitemap.xml',
  };
}
