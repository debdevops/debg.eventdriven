module.exports = {
  testEnvironment: 'jsdom',
  // Unit tests live under __tests__. The /tests folder contains integration/e2e helpers.
  roots: ['<rootDir>/__tests__'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        useESM: true
      }
    ]
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/setupTests.ts'],
  moduleNameMapper: {
    '^.+\\.(css|less|scss|sass)$': '<rootDir>/__mocks__/styleMock.js'
  }
}
