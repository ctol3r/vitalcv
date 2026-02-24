module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.ts'],
  setupFiles: ['./jest.setup.ts'],
  transformIgnorePatterns: [
    '<rootDir>/.*node_modules/(?!.*jose)',
  ],
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
