const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.ts'],
  moduleNameMapper: {
    // Match tsconfig.json paths: { "@/*": ["./*"] }
    '^@/(.*)$': '<rootDir>/$1',
  },
  // Only run real test files (avoid treating helper files under __tests__/ as test suites)
  testMatch: [
    '<rootDir>/**/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/**/__tests__/**/*.spec.[jt]s?(x)',
  ],
  testEnvironment: 'jest-environment-jsdom',
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
  const config = await createJestConfig(customJestConfig)();

  // next/jest injects pnpm-aware ignore patterns. Extend them so MSW v2 + deps get transformed.
  config.transformIgnorePatterns = [
    '/node_modules/(?!.pnpm)(?!(geist|msw|@mswjs|until-async)/)',
    '/node_modules/.pnpm/(?!(geist|msw|until-async|@mswjs\\\\+interceptors)@)',
    '^.+\\\\.module\\\\.(css|sass|scss)$',
  ];

  return config;
};
