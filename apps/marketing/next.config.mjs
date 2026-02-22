/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  env: {
    NEXT_PUBLIC_COMMIT_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.NEXT_PUBLIC_COMMIT_SHA ||
      '',
    NEXT_PUBLIC_DEPLOY_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
