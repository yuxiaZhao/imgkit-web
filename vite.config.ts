import { defineConfig } from 'vite';

export default defineConfig({
  root: 'demo',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
  resolve: {
    alias: {
      imgkit: new URL('./src/index.ts', import.meta.url).pathname,
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});