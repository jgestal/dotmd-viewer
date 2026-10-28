import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  // Rune effects only run with Svelte's browser build, which the test environment must ask for.
  resolve: { conditions: ['browser'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      // Vitest 4 measures only files that exist, so the command passes while these folders are empty.
      include: ['src/lib/domain/**', 'src/lib/application/**'],
      exclude: ['src/lib/__tests__/**', '**/*.test.ts'],
      reporter: ['text-summary', 'html'],
      // Business rules must stay well covered; UI glue is covered by the UI and E2E suites.
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
