import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], exclude: ['src/main.tsx'], tsconfigPath: './tsconfig.json' }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'FormaDXP',
      fileName: 'forma-dxp',
      cssFileName: 'forma-dxp',
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM', 'react/jsx-runtime': 'jsxRuntime' },
      },
    },
  },
});
