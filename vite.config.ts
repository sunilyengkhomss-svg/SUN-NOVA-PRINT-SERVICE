import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

function normalizeBaseUrl(raw?: string): string {
  const val = (raw || "").trim();
  if (!val || val === "/") return "/";
  if (/^https?:\/\//i.test(val)) {
    return val.endsWith("/") ? val : `${val}/`;
  }
  const withLead = val.startsWith("/") ? val : `/${val}`;
  return withLead.endsWith("/") ? withLead : `${withLead}/`;
}

function pruneOrtWasmPlugin() {
  return {
    name: "prune-ort-wasm",
    generateBundle(_options: unknown, bundle: Record<string, { type: string; source?: Uint8Array | string }>) {
      if (process.env.BUNDLE_ORT_WASM === "true") {
        console.log("[vite-build] BUNDLE_ORT_WASM=true: keeping local ONNX WASM assets bundled in dist.");
        return;
      }
      let removedCount = 0;
      for (const fileName of Object.keys(bundle)) {
        if (/^ort-wasm.*\.wasm$/i.test(fileName) || /^ort(\.webgpu)?\.bundle\.min\.mjs$/i.test(fileName)) {
          delete bundle[fileName];
          removedCount += 1;
        }
      }
      if (removedCount > 0) {
        console.log(
          `[vite-build] Pruned ${removedCount} local ONNX WASM asset(s) for lightweight CDN deploy (set BUNDLE_ORT_WASM=true to bundle locally).`
        );
      }
    },
  };
}

export default defineConfig(() => {
  return {
    base: normalizeBaseUrl(process.env.VITE_BASE_URL),
    plugins: [react(), tailwindcss(), pruneOrtWasmPlugin()],
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
