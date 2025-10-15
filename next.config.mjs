/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove deprecated experimental.instrumentationHook (Next 15 uses instrumentation.js automatically)
  webpack: (config) => {
    // jsonld (via @mattrglobal/jsonld-signatures-bbs) sometimes references old core-js v2 paths.
    // Map them to core-js v3 feature paths so build succeeds on Vercel.
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'core-js/fn/object/entries': 'core-js/features/object/entries',
      'core-js/fn/object/values': 'core-js/features/object/values',
      'core-js/fn/array/includes': 'core-js/features/array/includes',
      'core-js/fn/symbol': 'core-js/features/symbol'
    };
    return config;
  },
};
export default nextConfig;
