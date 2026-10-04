import { defineConfig } from 'vitest/config';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'for-referance/**',
      'scripts/**/*.test.mjs',
      'scripts/**/*.spec.ts',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage/renderer',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/{app,bridge,components,features,i18n,lib}/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/dev/**', 'src/main.tsx'],
    },
  },
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  envPrefix: ['VITE_', 'TAURI_'],
});
