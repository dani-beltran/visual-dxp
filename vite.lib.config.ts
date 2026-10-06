import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src/index.ts', 'src/components', 'src/lib'],
      exclude: ['src/app', 'src/server', 'src/app.tsx'],
      tsconfigPath: './tsconfig.lib.json',
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'visualDXP',
      fileName: 'visual-dxp',
      cssFileName: 'visual-dxp',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        exports: 'named',
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react/jsx-runtime': 'jsxRuntime' },
      },
    },
  },
});
