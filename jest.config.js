export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^testcafe$': '<rootDir>/tests/__mocks__/testcafe.js',
    '^@modelcontextprotocol/sdk/types\\.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/types.js',
    '^@modelcontextprotocol/sdk/server/index\\.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/index.js',
    '^@modelcontextprotocol/sdk/server/stdio\\.js$': '<rootDir>/tests/__mocks__/@modelcontextprotocol/sdk/server/stdio.js'
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@modelcontextprotocol|zod)/)'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html']
};