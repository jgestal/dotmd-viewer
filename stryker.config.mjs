// StrykerJS mutation testing for the business rules (domain and application layers).
// Run with `npm run test:mutation`. The score must stay at or above `break` (85 %).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  plugins: ['@stryker-mutator/vitest-runner'],
  mutate: ['src/lib/domain/**/*.ts', 'src/lib/application/**/*.ts', '!**/*.test.ts'],
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 95, low: 85, break: 85 },
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
  coverageAnalysis: 'perTest',
  tempDirName: '.stryker-tmp',
};
