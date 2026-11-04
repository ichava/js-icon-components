import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // The count guard generates the whole pinned pack once, for every flavour.
    testTimeout: 120_000,
    hookTimeout: 300_000,
  },
});
