import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only proxies. Two reasons they exist:
//  - NewsAPI's free tier refuses browser requests from anything but localhost (CORS).
//  - BBC publishes RSS, not an API, and sends no CORS headers at all.
// Production does the same job in nginx (see docker/nginx.conf.template), so the
// adapters call the same /api/* paths in both environments and never see a key.
const proxy = {
  '/api/newsapi': {
    target: 'https://newsapi.org/v2',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/newsapi/, ''),
  },
  '/api/guardian': {
    target: 'https://content.guardianapis.com',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/guardian/, ''),
  },
  '/api/nyt': {
    target: 'https://api.nytimes.com/svc/search/v2',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/nyt/, ''),
  },
  '/api/bbc': {
    target: 'https://feeds.bbci.co.uk',
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/api\/bbc/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 3000, proxy },
  test: {
    // e2e/ belongs to Playwright, not vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    // Real suites land with backlog item 3 (aggregator). Until then an empty run is
    // a pass, not a failure — otherwise the loop's test gate is red from iteration 1.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**', 'src/features/**/utils/**', 'src/hooks/**'],
    },
  },
})
