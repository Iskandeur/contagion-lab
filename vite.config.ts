import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' so assets resolve under https://iskandeur.github.io/contagion-lab/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
});
