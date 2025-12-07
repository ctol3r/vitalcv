import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Build safety: Enforce TypeScript and ESLint checks
  // eslint: {
  //   ignoreDuringBuilds: false, // Removed - enforce linting
  // },
  // typescript: {
  //   ignoreBuildErrors: false, // Removed - enforce type checking
  // },
  images: {
    // Enable image optimization for production
    unoptimized: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
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
  experimental: {
    regions: ['iad1', 'sfo1'],
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
    reactCompiler: true,
    optimizeCss: true,
  },
}

export default withNextIntl(nextConfig)
