import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Alias shared with vite.config.ts / tsconfig.json.
const alias = {
  '@': fileURLToPath(new URL('./src', import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    // Tests are re-ported after the React cutover — keep the runner green meanwhile.
    passWithNoTests: true,
    projects: [
      // Component/page tests (.test.tsx): DOM environment.
      {
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.tsx'],
        },
      },
      // Pure logic (stores, api, helpers): node.
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**'],
        },
      },
    ],
  },
});
