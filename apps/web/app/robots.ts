import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/internal/', '/review/', '/mission-ops/', '/pilot-ops/', '/holder/', '/workspace/'],
      },
    ],
    sitemap: 'https://vitalcv.com/sitemap.xml',
  };
}
