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
  async rewrites() {
    return [
      { source: '/.well-known/jwks.json', destination: '/api/.well-known/jwks.json' },
      { source: '/.well-known/did.json', destination: '/api/.well-known/did.json' },
      { source: '/.well-known/openid-credential-issuer', destination: '/api/.well-known/openid-credential-issuer' },
      { source: '/.well-known/trust.json', destination: '/api/.well-known/trust.json' },
      { source: '/.well-known/trust-register', destination: '/api/.well-known/trust-register' },
      { source: '/.well-known/openid-configuration', destination: '/api/.well-known/openid-credential-issuer' },
    ];
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

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      silent: true,
      hideSourceMaps: true,
    })
  : nextConfig;
