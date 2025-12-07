const path = require('node:path');

const tsconfigPath = path.resolve(__dirname, 'tsconfig.jest.json');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/apps', '<rootDir>/services', '<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  moduleNameMapper: {
    '^services/(.*)$': '<rootDir>/services/$1',
    '^backend/(.*)$': '<rootDir>/backend/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc-node/jest',
      {
        tsconfig: tsconfigPath,
        swcrc: false,
        sourceMaps: 'inline',
        module: {
          type: 'commonjs',
        },
        jsc: {
          target: 'es2019',
          parser: {
            syntax: 'typescript',
            tsx: true,
            decorators: true,
          },
          transform: {
            decoratorMetadata: true,
          },
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'apps/**/*.ts',
    'services/**/*.ts',
    'packages/**/*.ts',
    '!**/*.d.ts',
    '!**/*.test.ts',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};


