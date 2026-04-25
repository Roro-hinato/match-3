/// <reference types="vitest" />
import { defineConfig } from 'vite';

// `base` is the path under which the site is served. GitHub Pages serves
// at https://<user>.github.io/<repo>/, so assets must be referenced as
// /<repo>/assets/... in the built HTML.
//
// Set the GITHUB_REPO env var in CI (the workflow does this automatically),
// or hardcode it below if you prefer.
const repo = process.env.GITHUB_REPO ?? '';

export default defineConfig({
  base: repo ? `/${repo}/` : '/',
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    open: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
