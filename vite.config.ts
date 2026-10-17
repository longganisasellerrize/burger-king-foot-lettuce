import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps asset paths relative so the build works on any static host
// (e.g. GitHub Pages) together with the HashRouter used in src/main.tsx.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true },
});
