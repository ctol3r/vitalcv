import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://vitalcv.com';
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    rules: [
      {
        userAgent: '*',
        allow: isProduction ? [
          '/',
          '/start',
          '/jobs/*',
          '/org/*',
          '/verify',
          '/developers',
          '/support',
        ] : [],
        disallow: [
          '/admin/',
          '/dashboard/',
          '/api/',
          '/dev/',
          '/analytics/',
          '/ops/',
          '/wallet/',
          '/issuer/',
          '/claim/',
          '/npi/*/edit',
          '/search?*',
          '/*?demo=*',
          '/*?auto=*',
        ],
        crawlDelay: 1,
      },
      // Special rules for aggressive crawlers
      {
        userAgent: 'GPTBot',
        disallow: ['/'],
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: ['/'],
      },
      {
        userAgent: 'CCBot',
        disallow: ['/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

