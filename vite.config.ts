import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  return {
    base: process.env.VITE_BASE_URL || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    build: {
      outDir: 'dist',
      assetsDir: '',
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 32 * 1024,
      rolldownOptions: {
        output: {
          codeSplitting: false,
          entryFileNames: 'script.js',
          chunkFileNames: 'script.js',
          assetFileNames: (assetInfo) => {
            if (
              assetInfo.names?.some((name) => name.endsWith('.css')) ||
              assetInfo.name?.endsWith('.css')
            ) {
              return 'style.css';
            }
            return '[name][extname]';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
