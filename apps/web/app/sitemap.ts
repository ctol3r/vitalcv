import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://vitalcv.com', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://vitalcv.com/passport', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://vitalcv.com/explore', lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: 'https://vitalcv.com/employers', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.8 },
    { url: 'https://vitalcv.com/employers/kaiser-permanente-northern-california', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://vitalcv.com/pilot', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://vitalcv.com/review', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://vitalcv.com/developers', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: 'https://vitalcv.com/compliance', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://vitalcv.com/compliance/openid-self-cert', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: 'https://vitalcv.com/updates', lastModified: new Date(), changeFrequency: 'weekly', priority: 0.5 },
    { url: 'https://vitalcv.com/status', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.4 },
  ];
}
