import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'public',
    emptyOutDir: false,
    lib: {
      entry: 'src/bridge.ts',
      name: 'visualDXPBridge',
      formats: ['iife'],
      fileName: () => 'bridge.js',
    },
  },
});
