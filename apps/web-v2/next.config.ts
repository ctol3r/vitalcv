import type { NextConfig } from 'next';
import { getSecurityHeadersForNext } from './src/lib/security-headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Match every route — security headers are response-level.
        source: '/(.*)',
        headers: getSecurityHeadersForNext(),
      },
    ];
  },
};

export default nextConfig;
