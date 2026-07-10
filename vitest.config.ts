import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.js';

// Reuse the app's Vite config (react plugin, aliases) so tests resolve modules
// exactly like the build. Kept separate from vite.config.js so the production
// build config stays plain JS and untouched.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      css: false,
      // Clear call history between tests; do NOT restore (would wipe the
      // vi.hoisted() mock-chain implementations the auth test relies on).
      clearMocks: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        include: ['src/lib/**/*.ts'],
        exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/test/**'],
      },
    },
  }),
);
