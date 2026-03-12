module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: [
    '<rootDir>',
    '<rootDir>/../../../tests',
  ],
  testMatch: [
    '**/__tests__/**/*.ts',
    '<rootDir>/../../../tests/**/*.spec.ts',
  ],
  // Run sequentially — test files share a PostgreSQL database and use
  // unscoped deleteMany() in beforeEach, causing race conditions in parallel.
  maxWorkers: 1,
  setupFiles: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    '<rootDir>/.*node_modules/(?!.*jose)',
  ],
  moduleNameMapper: {
    '^@vitalcv/psv-adapters$': '<rootDir>/../../../packages/psv-adapters/index.ts',
    '^@vitalcv/psv-adapters/(.*)$': '<rootDir>/../../../packages/psv-adapters/$1',
  },
  transform: {
    '\\.m?[jt]sx?$': ['ts-jest', {
      tsconfig: {
        allowJs: true,
        module: 'commonjs',
        target: 'es2022',
        esModuleInterop: true,
      },
    }],
  },
};
