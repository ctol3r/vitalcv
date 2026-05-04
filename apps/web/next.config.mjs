import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@vitalcv/shared',
    '@vitalcv/crs',
    '@vitalcv/psv',
    '@vitalcv/ingest',
    '@vitalcv/trust-state',
  ],
  experimental: {
    externalDir: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/intelligence?view=dashboard', permanent: false },
      { source: '/docs/api', destination: '/developers', permanent: false },
      { source: '/employers/kaiser-permanente-norcal', destination: '/employers/kaiser-permanente-northern-california', permanent: false },
    ];
  },
  webpack: (config, { isServer }) => {
    if (process.env.NEXT_DISABLE_PWA === '1') {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
        chunkIds: 'deterministic',
      };
    }
    return config;
  },
};

// Only enable Sentry build-time instrumentation when DSN is configured
const sentryEnabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

// PWA service worker registration.
// sw.js lives at apps/web/public/sw.js and is served at /sw.js.
// Registration is handled client-side via navigator.serviceWorker.register('/sw.js')
// in the root layout. NEXT_DISABLE_PWA=1 disables registration in CI/SSR contexts.
const baseConfig = sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
    })
  : nextConfig;

export default baseConfig;
