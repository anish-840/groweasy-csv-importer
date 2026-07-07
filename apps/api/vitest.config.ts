import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
    // Force deterministic no-AI mode for tests so they never hit the network.
    env: {
      NODE_ENV: 'test',
      FORCE_FALLBACK: 'true',
      GEMINI_API_KEY: '',
    },
  },
});
