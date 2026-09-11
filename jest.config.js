module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // src altindaki tum .test.ts dosyalari
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  // Deno dosyalari Jest tarafindan asla okunmasin
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/supabase/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { diagnostics: false }],
  },
};