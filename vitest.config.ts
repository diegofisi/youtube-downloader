import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vitest/config';

// Alias compartidos con vite.config.ts / tsconfig.json.
const alias = {
  '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
  '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
  '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
  '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
};

const DOM_TESTS = ['src/**/ui/**/*.test.ts', 'src/app/**/*.test.ts'];

export default defineConfig({
  resolve: { alias },
  test: {
    passWithNoTests: true,
    projects: [
      // Módulos de UI (features/*/ui, shared/ui, app): entorno con DOM.
      {
        resolve: { alias },
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: DOM_TESTS,
        },
      },
      // Lógica pura (stores, apis, lib): node.
      {
        resolve: { alias },
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
          exclude: ['**/node_modules/**', ...DOM_TESTS],
        },
      },
    ],
  },
});
