module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).js',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: [
    'server/**/*.ts',
    'server/**/*.js',
    '!server/node_modules/**',
    '!server/scripts/**',
    '!server/**/*.test.ts',
    '!server/**/*.test.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/server/__tests__/setup.js'],
  // Run tests sequentially to prevent database contention
  maxWorkers: 1,
  // Increase timeout for individual tests
  testTimeout: 30000,
  // Handle TypeScript path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1',
    '^@/types/(.*)$': '<rootDir>/server/types/$1',
    '^@/utils/(.*)$': '<rootDir>/server/utils/$1'
  }
};
