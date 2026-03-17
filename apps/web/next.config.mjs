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
      { source: '/findings', destination: '/intelligence?view=findings', permanent: false },
      { source: '/storylines', destination: '/intelligence?view=storylines', permanent: false },
      { source: '/providers', destination: '/intelligence?view=providers', permanent: false },
      { source: '/actions', destination: '/intelligence?view=actions', permanent: false },
      { source: '/investigations', destination: '/intelligence?view=investigations', permanent: false },
      { source: '/calibration', destination: '/intelligence?view=calibration', permanent: false },
      { source: '/system-health', destination: '/intelligence?view=system-health', permanent: false },
      { source: '/graph', destination: '/intelligence?view=graph', permanent: false },
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
