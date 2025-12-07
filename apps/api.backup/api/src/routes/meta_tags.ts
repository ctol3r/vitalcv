import { Router } from 'express';

export const meta = Router();

/**
 * Round 33: Meta Tags Endpoint
 * Provides Open Graph and Twitter card metadata for landing page
 */
meta.get('/meta.json', (_req, res) => {
  res.json({
    title: 'VitalCV — Trust. Speed. Care.',
    description:
      'Credentialing and hiring at the speed of trust: verifiable credentials, selective disclosure, immutable audit anchors.',
    image: '/press/logo.svg',
    url: process.env.PUBLIC_ISSUER_URL || 'https://vitalcv.com',
    twitter: {
      card: 'summary_large_image',
      site: '@VitalCV',
      creator: '@VitalCV',
    },
    og: {
      type: 'website',
      locale: 'en_US',
      site_name: 'VitalCV',
    },
  });
});

