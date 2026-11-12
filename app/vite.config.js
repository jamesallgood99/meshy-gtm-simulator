import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' lets the build run from any path, including GitHub Pages project sites.
export default defineConfig({
  plugins: [react()],
  base: './',
});
