import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base must match the repo name for GitHub Pages: https://<user>.github.io/movie-list/
export default defineConfig({ plugins: [react()], base: '/movie-list/' });
