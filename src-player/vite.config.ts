import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: '../dist-player',
    emptyOutDir: true,
  },
  server: {
    port: 3001,
    open: true,
    proxy: {
      '/events': {
        target: 'ws://localhost:4310',
        ws: true,
        rewriteWsOrigin: true,
      },
    },
  },
});
