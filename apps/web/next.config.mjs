import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
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

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
    })
  : nextConfig;
