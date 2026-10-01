import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: false,
    lib: {
      entry: 'src/preview-bridge.ts',
      name: 'visualDXPPreviewBridge',
      formats: ['iife'],
      fileName: () => 'preview-bridge.js',
    },
  },
});
