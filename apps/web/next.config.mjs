import { withSentryConfig } from '@sentry/nextjs';
import { getSecurityHeadersForNext } from './security-headers.mjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Next sends `X-Powered-By: Next.js` on every response by default, naming
  // the framework (and, with it, the CVE list worth trying) to anyone
  // enumerating the origin, in exchange for nothing. The `headers()` block
  // below cannot remove it — that only ADDS headers — so it is turned off at
  // the framework level. Asserted absent by __tests__/security-headers.test.ts.
  poweredByHeader: false,
  transpilePackages: [
    '@vitalcv/shared',
    '@vitalcv/crs',
    '@vitalcv/psv',
    '@vitalcv/ingest',
    '@vitalcv/trust-state',
    '@vitalcv/domain-evidence',
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
      { source: '/.well-known/verifier-manifest.json', destination: '/api/.well-known/verifier-manifest.json' },
    ];
  },
  async redirects() {
    return [
      { source: '/dashboard', destination: '/intelligence?view=dashboard', permanent: false },
      { source: '/docs/api', destination: '/developers', permanent: false },
      { source: '/employers/kaiser-permanente-norcal', destination: '/employers/kaiser-permanente-northern-california', permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: getSecurityHeadersForNext(),
      },
      // Public provider surfaces must not be cached by any intermediary.
      // These routes send no Cache-Control today, so a CDN or proxy is free to
      // apply heuristic caching — which would keep serving a payload after a
      // correction ships. Declared here rather than per-response because each
      // proxy has several exit paths (upstream error, timeout, catch) and a
      // header added by hand would be missed on at least one of them.
      {
        source: '/api/providers',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/api/directory',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
      {
        source: '/api/directory/:path*',
        headers: [{ key: 'Cache-Control', value: 'no-store' }],
      },
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
