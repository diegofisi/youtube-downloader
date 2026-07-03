import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  clearScreen: false,
  // React (src-react) + Tailwind conviven con la app vanilla durante la migración.
  plugins: [react(), tailwindcss()],
  resolve: {
    // Espejo de "paths" de tsconfig.json (alias de arquitectura @core/@shared/@features/@app)
    // y de tsconfig.react.json ("@/" → src-react).
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@': fileURLToPath(new URL('./src-react', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      // Multi-page: vanilla en / (index.html), React en /react.html hasta el cutover.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        react: fileURLToPath(new URL('./react.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
