import { defineConfig } from 'vite';

// Base path for GitHub Pages. If deploying to https://USER.github.io/bloat-log/,
// set VITE_BASE_PATH=/bloat-log/ in your build env (or change the default below).
const base = process.env.VITE_BASE_PATH || '/';

export default defineConfig({
  base,
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
