import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node', // Integration tests don't need jsdom
    include: ['src/**/*.integration.test.{ts,tsx}'],
    testTimeout: 30000, // Longer timeout for database operations
    hookTimeout: 30000,
    retry: 0, // Don't retry - we want to see real failures
    // Run tests sequentially to avoid race conditions
    sequence: {
      concurrent: false,
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
